import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { ReferralModel, type ReferralDoc } from '../../models/Referral';

// Mounted at /api/referrals.
export const referralsRouter = Router();

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toLowerCase();
}

async function uniqueCode(): Promise<string> {
  let code = genCode();
  while (await ReferralModel.exists({ code })) code = genCode();
  return code;
}

function publicReferral(r: ReferralDoc) {
  return {
    code: r.code,
    commissionRate: r.commissionRate,
    clicks: r.clicks,
    signups: r.signups,
    earningsCents: r.earningsCents,
    referredCount: r.referredEmails.length,
  };
}

// ---- Public: record a referral-link click (no auth) ----
referralsRouter.post(
  '/track',
  validate({ body: z.object({ code: z.string().min(3).max(40) }) }),
  asyncHandler(async (req, res) => {
    await ReferralModel.updateOne({ code: String(req.body.code).toLowerCase() }, { $inc: { clicks: 1 } });
    res.json({ ok: true });
  }),
);

// ---- Authenticated creator routes ----
referralsRouter.use(requireAuth);

// Returns the creator's referral record, or null if they haven't created one yet.
referralsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ref = await ReferralModel.findOne({ creatorId: req.user!.id });
    res.json({ referral: ref ? publicReferral(ref) : null });
  }),
);

// Create the referral code (idempotent — returns the existing one if present).
referralsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    let ref = await ReferralModel.findOne({ creatorId: req.user!.id });
    if (!ref) ref = await ReferralModel.create({ creatorId: req.user!.id, code: await uniqueCode() });
    res.status(201).json({ referral: publicReferral(ref) });
  }),
);

// Regenerate the share code.
referralsRouter.post(
  '/regenerate',
  asyncHandler(async (req, res) => {
    let ref = await ReferralModel.findOne({ creatorId: req.user!.id });
    if (!ref) ref = await ReferralModel.create({ creatorId: req.user!.id, code: await uniqueCode() });
    else { ref.code = await uniqueCode(); await ref.save(); }
    res.json({ referral: publicReferral(ref) });
  }),
);
