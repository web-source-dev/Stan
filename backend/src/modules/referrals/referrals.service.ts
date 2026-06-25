import { Types } from 'mongoose';
import { ReferralModel, type ReferralDoc } from '../../models/Referral';
import { UserModel, type UserDoc } from '../../models/User';
import { recordAudit } from '../../lib/audit';

const DEFAULT_COMMISSION_RATE = 0.2;

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toLowerCase();
}

async function uniqueCode(): Promise<string> {
  let code = genCode();
  while (await ReferralModel.exists({ code })) code = genCode();
  return code;
}

export function publicReferral(r: ReferralDoc) {
  return {
    code: r.code,
    commissionRate: r.commissionRate ?? DEFAULT_COMMISSION_RATE,
    clicks: r.clicks,
    signups: r.signups,
    earningsCents: r.earningsCents,
    referredCount: r.referredEmails.length,
  };
}

/** Record a click on a referral link. Returns false when the code is unknown. */
export async function trackClick(code: string): Promise<boolean> {
  const normalized = code.trim().toLowerCase();
  const res = await ReferralModel.updateOne({ code: normalized }, { $inc: { clicks: 1 } });
  return res.matchedCount > 0;
}

/**
 * Link a new account to a referrer. Rejects self-referrals and unknown codes.
 * Stores creator id so commission survives code regeneration.
 */
export async function attributeSignup(user: UserDoc, email: string, refCode?: string): Promise<boolean> {
  if (!refCode?.trim()) return false;
  const referrer = await ReferralModel.findOne({ code: refCode.trim().toLowerCase() });
  if (!referrer) return false;
  if (String(referrer.creatorId) === String(user._id)) return false;

  await ReferralModel.updateOne(
    { _id: referrer._id },
    { $inc: { signups: 1 }, $addToSet: { referredEmails: email.toLowerCase() } },
  );
  user.referredByCode = referrer.code;
  user.set('referredByCreatorId', referrer.creatorId);
  await user.save();
  recordAudit({
    action: 'referral.signup_attributed',
    actorId: user.id,
    actorType: 'user',
    creatorId: String(referrer.creatorId),
    metadata: { code: referrer.code },
  });
  return true;
}

/** Credit commission to the referrer on referred-creator subscription revenue. */
export async function accrueCommissionForUser(userId: string, amountCents: number): Promise<void> {
  if (amountCents <= 0) return;
  try {
    const user = await UserModel.findById(userId).select('referredByCreatorId referredByCode');
    if (!user) return;

    let ref: ReferralDoc | null = null;
    const creatorId = user.get('referredByCreatorId') as Types.ObjectId | undefined;
    if (creatorId) {
      ref = await ReferralModel.findOne({ creatorId });
    } else if (user.referredByCode) {
      ref = await ReferralModel.findOne({ code: user.referredByCode });
    }
    if (!ref) return;

    const rate = ref.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const commission = Math.round(amountCents * rate);
    if (commission <= 0) return;

    await ReferralModel.updateOne({ _id: ref._id }, { $inc: { earningsCents: commission } });
    recordAudit({
      action: 'referral.commission_accrued',
      actorType: 'system',
      creatorId: String(ref.creatorId),
      metadata: { referredUserId: userId, amountCents, commission },
    });
  } catch {
    /* never block billing */
  }
}

export async function getReferralForCreator(creatorId: string) {
  const ref = await ReferralModel.findOne({ creatorId });
  return ref ? publicReferral(ref) : null;
}

export async function createOrGetReferral(creatorId: string) {
  let ref = await ReferralModel.findOne({ creatorId });
  if (!ref) ref = await ReferralModel.create({ creatorId, code: await uniqueCode() });
  return publicReferral(ref);
}

export async function regenerateReferralCode(creatorId: string) {
  let ref = await ReferralModel.findOne({ creatorId });
  if (!ref) ref = await ReferralModel.create({ creatorId, code: await uniqueCode() });
  else {
    ref.code = await uniqueCode();
    await ref.save();
  }
  return publicReferral(ref);
}

/** Referred creators for the dashboard (email + signup date). */
export async function listReferredCreators(creatorId: string) {
  const ref = await ReferralModel.findOne({ creatorId });
  const filter = ref
    ? { $or: [{ referredByCreatorId: creatorId }, { referredByCode: ref.code }] }
    : { referredByCreatorId: creatorId };
  const users = await UserModel.find(filter)
    .select('email createdAt referredByCode')
    .sort({ createdAt: -1 })
    .limit(100);
  return users.map((u) => ({
    email: u.email,
    signedUpAt: u.get('createdAt'),
    code: u.referredByCode || '',
  }));
}
