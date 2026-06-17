import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { SubscriptionModel, PLAN_PRICES, type SubscriptionDoc } from '../../models/Subscription';
import { UserModel } from '../../models/User';
import { ReferralModel } from '../../models/Referral';

// Mounted at /api/subscription.
export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

/**
 * Credit the referrer a lifetime commission when a referred creator pays for a
 * plan. Best-effort: never blocks the subscription change. Guarded by the caller
 * so it only fires on a genuine transition into a paid active plan (not on every
 * plan toggle), preventing double-counting.
 */
async function accrueReferralCommission(userId: string, planCents: number): Promise<void> {
  if (planCents <= 0) return;
  try {
    const user = await UserModel.findById(userId);
    if (!user?.referredByCode) return;
    const ref = await ReferralModel.findOne({ code: user.referredByCode });
    if (!ref) return;
    const commission = Math.round(planCents * (ref.commissionRate ?? 0));
    if (commission > 0) {
      await ReferralModel.updateOne({ _id: ref._id }, { $inc: { earningsCents: commission } });
    }
  } catch { /* never block billing on a commission accrual error */ }
}

function publicSub(s: SubscriptionDoc) {
  const price = PLAN_PRICES[s.plan];
  return {
    plan: s.plan,
    status: s.status,
    label: price?.label ?? 'Creator',
    priceCents: price?.cents ?? 0,
    interval: price?.interval ?? 'month',
    stanleyAddon: s.stanleyAddon,
    trialEndsAt: s.trialEndsAt,
    currentPeriodEnd: s.currentPeriodEnd,
  };
}

async function getOrCreate(userId: string): Promise<SubscriptionDoc> {
  let sub = await SubscriptionModel.findOne({ userId });
  if (!sub) {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    sub = await SubscriptionModel.create({ userId, plan: 'monthly', status: 'trialing', trialEndsAt });
  }
  return sub;
}

subscriptionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ subscription: publicSub(await getOrCreate(req.user!.id)) });
  }),
);

subscriptionRouter.post(
  '/select',
  validate({ body: z.object({ plan: z.enum(['monthly', 'yearly', 'bundle']) }) }),
  asyncHandler(async (req, res) => {
    const sub = await getOrCreate(req.user!.id);
    const wasActive = sub.status === 'active';
    sub.plan = req.body.plan;
    sub.stanleyAddon = req.body.plan === 'bundle';
    // Selecting/switching a plan reactivates the subscription (unless still in a
    // live trial) and resets the billing period to the new plan's interval —
    // otherwise a previously-canceled sub would display as a priced active plan.
    const inTrial = sub.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt.getTime() > Date.now();
    if (!inTrial) {
      sub.status = 'active';
      const months = PLAN_PRICES[sub.plan]?.interval === 'year' ? 12 : 1;
      sub.currentPeriodEnd = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
    }
    await sub.save();
    // Accrue referral commission only on a genuine transition into a paid active
    // plan (was not already active, and not still inside a free trial). Switching
    // plans while already active does not re-accrue.
    if (!inTrial && !wasActive) {
      await accrueReferralCommission(req.user!.id, PLAN_PRICES[sub.plan]?.cents ?? 0);
    }
    res.json({ subscription: publicSub(sub) });
  }),
);

subscriptionRouter.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const sub = await getOrCreate(req.user!.id);
    sub.status = 'canceled';
    await sub.save();
    res.json({ subscription: publicSub(sub) });
  }),
);
