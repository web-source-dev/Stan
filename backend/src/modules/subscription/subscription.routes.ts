import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import {
  SubscriptionModel,
  PLANS,
  PLAN_FEATURES,
  STORAGE_PACKS,
  storageQuotaBytes,
  normalizePlan,
  effectiveTier,
  type PlanKey,
  type StoragePackKey,
  type SubscriptionDoc,
} from '../../models/Subscription';
import { UserModel } from '../../models/User';
import { ReferralModel } from '../../models/Referral';
import { env } from '../../config/env';
import { requireStripe } from '../../lib/stripe';

// Mounted at /api/subscription.
export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

/**
 * Credit the referrer a lifetime commission when a referred creator pays for a
 * plan. Best-effort: never blocks the subscription change.
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
  const planKey = normalizePlan(s.plan);
  const plan = PLANS[planKey];
  const tier = effectiveTier(s);
  const features = PLAN_FEATURES[tier];
  const extraStorageBytes = s.extraStorageBytes ?? 0;
  const quota = storageQuotaBytes(features, extraStorageBytes);
  return {
    plan: planKey,
    tier, // the tier whose features currently apply (free if trial lapsed)
    nominalTier: plan.tier, // the tier they've selected (even if trial lapsed)
    status: s.status,
    label: plan.label,
    priceCents: plan.cents,
    interval: plan.interval,
    stanleyAddon: s.stanleyAddon,
    trialEndsAt: s.trialEndsAt,
    currentPeriodEnd: s.currentPeriodEnd,
    features,
    storage: {
      baseBytes: features.maxStorageBytes,
      extraBytes: extraStorageBytes,
      quotaBytes: quota === Infinity ? null : quota,
    },
  };
}

/** The plan catalogue the picker renders. */
const PLAN_CATALOGUE = (['free', 'pro_monthly', 'pro_yearly', 'premium_monthly', 'premium_yearly'] as PlanKey[]).map(
  (key) => ({ key, ...PLANS[key], features: PLAN_FEATURES[PLANS[key].tier] }),
);

/** The storage add-on catalogue the "buy more storage" UI renders. */
const STORAGE_PACK_CATALOGUE = (Object.keys(STORAGE_PACKS) as StoragePackKey[]).map((key) => ({
  key,
  ...STORAGE_PACKS[key],
}));

async function getOrCreate(userId: string): Promise<SubscriptionDoc> {
  let sub = await SubscriptionModel.findOne({ userId });
  if (!sub) {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    sub = await SubscriptionModel.create({ userId, plan: 'pro_monthly', status: 'trialing', trialEndsAt });
  }
  return sub;
}

subscriptionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({
      subscription: publicSub(await getOrCreate(req.user!.id)),
      plans: PLAN_CATALOGUE,
      storagePacks: STORAGE_PACK_CATALOGUE,
    });
  }),
);

/**
 * Buy a one-time extra-storage pack. In demo mode (no Stripe) the storage is
 * granted immediately; with Stripe configured this returns a platform Checkout
 * URL and the grant happens on the `checkout.session.completed` webhook.
 */
subscriptionRouter.post(
  '/storage/purchase',
  validate({ body: z.object({ pack: z.enum(['gb5', 'gb20', 'gb80']) }) }),
  asyncHandler(async (req, res) => {
    const pack = STORAGE_PACKS[req.body.pack as StoragePackKey];
    const sub = await getOrCreate(req.user!.id);

    if (env.demoCheckout) {
      sub.extraStorageBytes = (sub.extraStorageBytes ?? 0) + pack.bytes;
      await sub.save();
      return res.json({ demo: true, subscription: publicSub(sub) });
    }

    const stripe = requireStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${env.APP_URL}/dashboard/media?storage=success`,
      cancel_url: `${env.APP_URL}/dashboard/media?storage=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.cents,
            product_data: { name: `${pack.label} extra storage` },
          },
        },
      ],
      metadata: { itemType: 'storage_addon', userId: req.user!.id, packBytes: String(pack.bytes) },
    });
    res.json({ url: session.url, sessionId: session.id });
  }),
);

subscriptionRouter.post(
  '/select',
  validate({
    body: z.object({
      plan: z.enum(['free', 'pro_monthly', 'pro_yearly', 'premium_monthly', 'premium_yearly']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const sub = await getOrCreate(req.user!.id);
    const plan = req.body.plan as PlanKey;
    const wasPaidActive = sub.status === 'active' && PLANS[normalizePlan(sub.plan)].tier !== 'free';
    sub.plan = plan;
    sub.stanleyAddon = PLANS[plan].tier === 'premium';

    if (plan === 'free') {
      // Downgrade: free tier, no trial, no billing period.
      sub.status = 'active';
      sub.trialEndsAt = undefined;
      sub.currentPeriodEnd = undefined;
    } else {
      // Selecting a paid plan activates it immediately (demo: no real card) and
      // resets the billing period to the plan's interval.
      sub.status = 'active';
      const months = PLANS[plan].interval === 'year' ? 12 : 1;
      sub.currentPeriodEnd = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
    }
    await sub.save();

    // Accrue referral commission only on a genuine first transition into a paid
    // active plan (not when already on a paid plan, and not for free).
    if (plan !== 'free' && !wasPaidActive) {
      await accrueReferralCommission(req.user!.id, PLANS[plan].cents);
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
