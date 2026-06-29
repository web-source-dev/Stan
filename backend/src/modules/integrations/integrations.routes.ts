import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { recordAudit } from '../../lib/audit';
import { getEntitlements } from '../subscription/subscription.guard';
import { IntegrationModel, INTEGRATION_PROVIDERS, type IntegrationDoc, type IntegrationProvider } from '../../models/Integration';
import { buildLoginUrl, isLiveInstagramConnection } from './instagram.service';

// Mounted at /api/integrations.
export const integrationsRouter = Router();
integrationsRouter.use(requireAuth);

/**
 * Connecting Instagram is only useful for AutoDM, so gate its connect/confirm/
 * disconnect actions on the autodm feature (Premium). Other providers pass.
 */
const gateInstagram = asyncHandler(async (req, _res, next) => {
  if (req.params.provider === 'instagram') {
    const { features } = await getEntitlements(req.user!.id);
    if (!features.autodm) {
      throw new AppError(403, 'upgrade_required', 'Instagram / AutoDM is a Premium feature. Upgrade to connect it.', {
        feature: 'autodm',
      });
    }
  }
  next();
});

const META = {
  instagram: { label: 'Instagram' },
  tiktok: { label: 'TikTok' },
  google_calendar: { label: 'Google Calendar' },
  zoom: { label: 'Zoom' },
  zapier: { label: 'Zapier' },
} as const;

function publicIntegration(provider: IntegrationProvider, doc: IntegrationDoc | null) {
  const connected = doc?.status === 'connected';
  return {
    provider,
    status: doc?.status ?? 'disconnected',
    connected,
    accountName: doc?.accountName ?? '',
    connectedAt: doc?.connectedAt ?? null,
    liveMode: provider === 'instagram' ? isLiveInstagramConnection(doc) : connected,
    tokenExpiresAt: provider === 'instagram' ? doc?.tokenExpiresAt ?? null : null,
  };
}

const providerParam = z.object({ provider: z.enum(INTEGRATION_PROVIDERS) });

// List every provider with its connection status for this creator.
integrationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const docs = await IntegrationModel.find({ creatorId: req.user!.id });
    const byProvider = new Map(docs.map((d) => [d.provider, d]));
    res.json({ integrations: INTEGRATION_PROVIDERS.map((p) => publicIntegration(p, byProvider.get(p) ?? null)) });
  }),
);

// Begin connecting — marks the row pending and returns the authorize URL.
// With real provider keys this returns the provider OAuth URL; otherwise it
// points at the in-app authorize/consent screen which completes the handshake.
integrationsRouter.post(
  '/:provider/connect',
  validate({ params: providerParam }),
  gateInstagram,
  asyncHandler(async (req, res) => {
    const provider = req.params.provider as IntegrationProvider;
    const creatorId = req.user!.id;
    let doc = await IntegrationModel.findOne({ creatorId, provider });
    if (!doc) doc = await IntegrationModel.create({ creatorId, provider, status: 'pending' });
    else { doc.status = 'pending'; await doc.save(); }
    // When real Instagram credentials are configured, send the creator through
    // the genuine Instagram OAuth consent dialog; otherwise fall back to the
    // in-app authorize screen that completes the demo handshake.
    const authorizeUrl =
      provider === 'instagram' && env.instagramConfigured
        ? buildLoginUrl(creatorId)
        : `${env.APP_URL}/integrations/authorize?provider=${provider}`;
    res.json({ authorizeUrl });
  }),
);

// Complete the connection (called from the authorize screen after consent).
integrationsRouter.post(
  '/:provider/confirm',
  validate({ params: providerParam, body: z.object({ accountName: z.string().max(120).optional() }) }),
  gateInstagram,
  asyncHandler(async (req, res) => {
    const provider = req.params.provider as IntegrationProvider;
    const creatorId = req.user!.id;
    let doc = await IntegrationModel.findOne({ creatorId, provider });
    if (!doc) doc = await IntegrationModel.create({ creatorId, provider });
    doc.status = 'connected';
    doc.accountName = req.body.accountName || META[provider].label;
    doc.connectedAt = new Date();
    await doc.save();
    recordAudit({ action: 'integration.connected', actorId: creatorId, actorType: 'user', creatorId, targetType: 'integration', targetId: provider });
    res.json({ integration: publicIntegration(provider, doc) });
  }),
);

integrationsRouter.post(
  '/:provider/disconnect',
  validate({ params: providerParam }),
  gateInstagram,
  asyncHandler(async (req, res) => {
    const provider = req.params.provider as IntegrationProvider;
    const creatorId = req.user!.id;
    const doc = await IntegrationModel.findOne({ creatorId, provider });
    if (doc) {
      doc.status = 'disconnected';
      doc.accountName = '';
      doc.connectedAt = undefined;
      doc.externalAccountId = '';
      doc.pageId = '';
      doc.tokenExpiresAt = undefined;
      doc.set('accessToken', '');
      doc.set('refreshToken', '');
      await doc.save();
    }
    recordAudit({ action: 'integration.disconnected', actorId: creatorId, actorType: 'user', creatorId, targetType: 'integration', targetId: provider });
    res.json({ integration: publicIntegration(provider, doc ?? null) });
  }),
);
