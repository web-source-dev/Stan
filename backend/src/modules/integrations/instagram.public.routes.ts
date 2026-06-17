import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { recordAudit } from '../../lib/audit';
import { verifyOAuthState, exchangeCodeForAccount, persistConnection } from './instagram.service';

/**
 * Public Instagram OAuth callback. Mounted at /api/integrations/instagram
 * BEFORE the authenticated integrations router, because Facebook redirects the
 * browser here without our session cookie — the creator is identified from the
 * signed `state` param instead.
 */
export const instagramPublicRouter = Router();

const back = (status: string) => `${env.APP_URL}/dashboard/autodm?instagram=${status}`;

instagramPublicRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error || !code || !state) {
      return res.redirect(back('error'));
    }
    let creatorId: string;
    try {
      creatorId = verifyOAuthState(state);
    } catch {
      return res.redirect(back('error'));
    }
    try {
      const account = await exchangeCodeForAccount(code);
      await persistConnection(creatorId, account);
      recordAudit({
        action: 'integration.connected',
        actorId: creatorId,
        actorType: 'user',
        creatorId,
        targetType: 'integration',
        targetId: 'instagram',
        metadata: { igAccountId: account.igAccountId },
      });
      return res.redirect(back('connected'));
    } catch (err) {
      logger.error({ err }, 'Instagram OAuth callback failed');
      return res.redirect(back('error'));
    }
  }),
);
