import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { ReferralModel, type ReferralDoc } from '../../models/Referral';

// Mounted at /api/referrals.
export const referralsRouter = Router();
referralsRouter.use(requireAuth);

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toLowerCase();
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

async function getOrCreate(creatorId: string): Promise<ReferralDoc> {
  let ref = await ReferralModel.findOne({ creatorId });
  if (!ref) {
    let code = genCode();
    // Avoid the (rare) collision on the unique code index.
    while (await ReferralModel.exists({ code })) code = genCode();
    ref = await ReferralModel.create({ creatorId, code });
  }
  return ref;
}

referralsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ref = await getOrCreate(req.user!.id);
    res.json({ referral: publicReferral(ref) });
  }),
);

// Regenerate the share code.
referralsRouter.post(
  '/regenerate',
  asyncHandler(async (req, res) => {
    const ref = await getOrCreate(req.user!.id);
    let code = genCode();
    while (await ReferralModel.exists({ code })) code = genCode();
    ref.code = code;
    await ref.save();
    res.json({ referral: publicReferral(ref) });
  }),
);
