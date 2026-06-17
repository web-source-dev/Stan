import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { UserModel } from '../../models/User';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { RefreshSessionModel } from '../../models/RefreshSession';
import { AppError } from '../../utils/AppError';
import { recordAudit } from '../../lib/audit';

// Account-level settings (mounted at /api/account).
export const accountRouter = Router();
accountRouter.use(requireAuth);

const PREF_KEYS = [
  'calendarBookings',
  'ordersFulfillment',
  'purchaseConfirmations',
  'leadCaptured',
  'membershipCancellations',
  'recurringPayments',
] as const;

const prefsSchema = z.object(
  Object.fromEntries(PREF_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
    (typeof PREF_KEYS)[number],
    z.ZodOptional<z.ZodBoolean>
  >,
);

accountRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id).select('notificationPrefs twoFactorEnabled');
    if (!user) throw AppError.notFound('User not found');
    res.json({ prefs: user.get('notificationPrefs'), twoFactorEnabled: user.get('twoFactorEnabled') });
  }),
);

accountRouter.patch(
  '/notifications',
  validate({ body: prefsSchema }),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    if (!user) throw AppError.notFound('User not found');
    const prefs = { ...(user.get('notificationPrefs') ?? {}) };
    for (const k of PREF_KEYS) if (typeof req.body[k] === 'boolean') prefs[k] = req.body[k];
    user.set('notificationPrefs', prefs);
    await user.save();
    res.json({ prefs: user.get('notificationPrefs') });
  }),
);

accountRouter.post(
  '/two-factor',
  validate({ body: z.object({ enabled: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    if (!user) throw AppError.notFound('User not found');
    user.set('twoFactorEnabled', req.body.enabled);
    await user.save();
    res.json({ twoFactorEnabled: user.get('twoFactorEnabled') });
  }),
);

accountRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const sessions = await RefreshSessionModel.find({
      userId: req.user!.id,
      revokedAt: { $exists: false },
      replacedByJti: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(20);
    // The most recently issued active session is treated as the current device.
    res.json({
      sessions: sessions.map((s, i) => ({
        id: s.id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.get('createdAt'),
        current: i === 0,
      })),
    });
  }),
);

// Revoke every active session except the most recent (the current device).
accountRouter.post(
  '/sessions/revoke-others',
  asyncHandler(async (req, res) => {
    const active = await RefreshSessionModel.find({
      userId: req.user!.id,
      revokedAt: { $exists: false },
      replacedByJti: { $exists: false },
    }).sort({ createdAt: -1 });
    const toRevoke = active.slice(1).map((s) => s.id);
    if (toRevoke.length) {
      await RefreshSessionModel.updateMany({ _id: { $in: toRevoke } }, { $set: { revokedAt: new Date() } });
    }
    res.json({ ok: true, revoked: toRevoke.length });
  }),
);

accountRouter.post(
  '/delete',
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    if (!user) throw AppError.notFound('User not found');
    user.set('status', 'deactivated');
    user.set('tokenVersion', (user.get('tokenVersion') ?? 0) + 1);
    await user.save();
    // Take the public storefront down so a deactivated account is no longer
    // reachable or purchasable.
    await CreatorProfileModel.updateOne({ userId: user.id }, { $set: { published: false } });
    await RefreshSessionModel.updateMany({ userId: user.id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    recordAudit({ action: 'account.delete_requested', actorType: 'user', actorId: user.id, creatorId: user.id });
    res.json({ ok: true });
  }),
);
