import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { SubscriptionModel, PLAN_PRICES, type SubscriptionDoc } from '../../models/Subscription';

// Mounted at /api/subscription.
export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

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
    sub.plan = req.body.plan;
    sub.stanleyAddon = req.body.plan === 'bundle';
    await sub.save();
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
