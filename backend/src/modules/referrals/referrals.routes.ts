import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import * as service from './referrals.service';

// Mounted at /api/referrals.
export const referralsRouter = Router();

referralsRouter.post(
  '/track',
  publicWriteLimiter,
  validate({ body: z.object({ code: z.string().min(3).max(40) }) }),
  asyncHandler(async (req, res) => {
    const ok = await service.trackClick(String(req.body.code));
    res.json({ ok });
  }),
);

referralsRouter.use(requireAuth);

referralsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ referral: await service.getReferralForCreator(req.user!.id) });
  }),
);

referralsRouter.get(
  '/referred',
  asyncHandler(async (req, res) => {
    res.json({ referred: await service.listReferredCreators(req.user!.id) });
  }),
);

referralsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const referral = await service.createOrGetReferral(req.user!.id);
    res.status(201).json({ referral });
  }),
);

referralsRouter.post(
  '/regenerate',
  asyncHandler(async (req, res) => {
    res.json({ referral: await service.regenerateReferralCode(req.user!.id) });
  }),
);
