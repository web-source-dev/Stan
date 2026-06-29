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
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { InvoiceModel, type InvoiceDoc } from '../../models/Invoice';
import { createSubscriptionInvoice, nextInvoiceNumber, activateSubscriptionPlan } from './subscription.service';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { requireStripe } from '../../lib/stripe';

// Mounted at /api/subscription.
export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

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
    cancelAtPeriodEnd: Boolean(s.cancelAtPeriodEnd),
    features,
    storage: {
      baseBytes: features.maxStorageBytes,
      extraBytes: extraStorageBytes,
      quotaBytes: quota === Infinity ? null : quota,
    },
    paymentMethod: s.paymentMethod?.last4
      ? {
          brand: s.paymentMethod.brand || 'card',
          last4: s.paymentMethod.last4,
          expMonth: s.paymentMethod.expMonth,
          expYear: s.paymentMethod.expYear,
        }
      : null,
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

function publicInvoice(inv: InvoiceDoc) {
  return {
    id: inv.id,
    number: inv.number,
    kind: inv.kind,
    description: inv.description,
    interval: inv.interval,
    amountCents: inv.amountCents,
    currency: inv.currency,
    status: inv.status,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    paidAt: inv.paidAt ?? inv.get('createdAt'),
    createdAt: inv.get('createdAt'),
  };
}

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
      stripeConfigured: env.stripeConfigured,
      demoCheckout: env.demoCheckout,
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
      await InvoiceModel.create({
        userId: req.user!.id,
        number: await nextInvoiceNumber(req.user!.id),
        kind: 'storage',
        description: `${pack.label} extra storage`,
        interval: 'one_time',
        amountCents: pack.cents,
        currency: 'usd',
        status: 'paid',
        paidAt: new Date(),
      }).catch(() => {});
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

    if (plan === 'free') {
      sub.plan = plan;
      sub.stanleyAddon = false;
      sub.cancelAtPeriodEnd = false;
      sub.status = 'active';
      sub.trialEndsAt = undefined;
      sub.currentPeriodEnd = undefined;
      await sub.save();
      return res.json({ subscription: publicSub(sub) });
    }

    if (env.demoCheckout) {
      await activateSubscriptionPlan(req.user!.id, plan);
      return res.json({ subscription: publicSub(await getOrCreate(req.user!.id)), demo: true });
    }

    const planInfo = PLANS[plan];
    const stripe = requireStripe();
    const user = await UserModel.findById(req.user!.id);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${env.APP_URL}/dashboard/settings?tab=billing&plan=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/dashboard/settings?tab=billing&plan=cancelled`,
      customer_email: user?.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: planInfo.cents,
            product_data: {
              name: `${planInfo.label} plan (${planInfo.interval === 'year' ? 'yearly' : 'monthly'})`,
            },
          },
        },
      ],
      metadata: { itemType: 'subscription_plan', userId: req.user!.id, plan },
    });
    res.json({ url: session.url, sessionId: session.id });
  }),
);

/** Fulfil a platform subscription checkout when webhooks aren't forwarded (local dev). */
subscriptionRouter.post(
  '/complete',
  validate({ body: z.object({ sessionId: z.string().min(1).max(200) }) }),
  asyncHandler(async (req, res) => {
    if (env.demoCheckout) throw AppError.badRequest('Not used in demo mode');
    const stripe = requireStripe();
    const session = await stripe.checkout.sessions.retrieve(req.body.sessionId);
    if (session.payment_status !== 'paid') throw AppError.badRequest('Payment not completed');
    if (session.metadata?.itemType !== 'subscription_plan') throw AppError.badRequest('Invalid session');
    if (session.metadata.userId !== req.user!.id) throw AppError.forbidden('Session does not belong to this account');
    const plan = session.metadata.plan as PlanKey;
    if (!(plan in PLANS)) throw AppError.badRequest('Invalid plan');
    await activateSubscriptionPlan(req.user!.id, plan);
    res.json({ subscription: publicSub(await getOrCreate(req.user!.id)) });
  }),
);

/**
 * Invoice history for the creator's own subscription. If a paid subscription has
 * no invoices yet (e.g. it predates this feature), backfill one for the current
 * period so the billing page always reflects the active plan.
 */
subscriptionRouter.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    let invoices = await InvoiceModel.find({ userId }).sort({ createdAt: -1 }).limit(100);
    if (invoices.length === 0) {
      const sub = await getOrCreate(userId);
      const planKey = normalizePlan(sub.plan);
      if (PLANS[planKey].cents > 0 && (sub.status === 'active' || sub.status === 'trialing')) {
        const inv = await createSubscriptionInvoice(userId, planKey, sub.currentPeriodEnd).catch(() => null);
        if (inv) invoices = [inv];
      }
    }
    res.json({ invoices: invoices.map(publicInvoice) });
  }),
);

/** A single invoice + the parties, for the printable/downloadable view. */
subscriptionRouter.get(
  '/invoices/:id',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    const inv = await InvoiceModel.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!inv) throw AppError.notFound('Invoice not found');
    const [user, profile] = await Promise.all([
      UserModel.findById(req.user!.id),
      CreatorProfileModel.findOne({ userId: req.user!.id }),
    ]);
    const a = profile?.get('address') as { street?: string; city?: string; state?: string; postalCode?: string; country?: string } | undefined;
    const address = [a?.street, [a?.city, a?.state].filter(Boolean).join(', '), a?.postalCode, a?.country]
      .filter((x) => x && String(x).trim())
      .join('\n');
    res.json({
      invoice: publicInvoice(inv),
      billTo: {
        name: profile?.displayName || profile?.username || user?.email || 'Customer',
        email: user?.email ?? '',
        address,
      },
      seller: {
        name: 'CreatorStore, Inc.',
        detail: 'Stan subscription billing',
        email: env.EMAIL_FROM.replace(/.*<(.+)>.*/, '$1'),
      },
    });
  }),
);

/**
 * Save a card on file — MASKED ONLY. The client must send just brand/last4/exp
 * (derived in the browser); the full PAN and CVC must never reach the server.
 * We hard-reject anything longer than 4 digits in last4 to enforce that.
 */
subscriptionRouter.post(
  '/payment-method',
  validate({
    body: z.object({
      brand: z.string().max(20).optional().default('card'),
      last4: z.string().regex(/^\d{4}$/, 'last4 must be exactly 4 digits'),
      expMonth: z.number().int().min(1).max(12),
      expYear: z.number().int().min(2000).max(2100),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { brand, last4, expMonth, expYear } = req.body as {
      brand: string; last4: string; expMonth: number; expYear: number;
    };
    // Reject an already-expired card.
    const now = new Date();
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      throw AppError.badRequest('That card has expired.');
    }
    const sub = await getOrCreate(req.user!.id);
    sub.set('paymentMethod', { brand: brand.toLowerCase().slice(0, 20), last4, expMonth, expYear, updatedAt: new Date() });
    await sub.save();
    res.json({ subscription: publicSub(sub) });
  }),
);

subscriptionRouter.delete(
  '/payment-method',
  asyncHandler(async (req, res) => {
    const sub = await getOrCreate(req.user!.id);
    sub.set('paymentMethod', undefined);
    await sub.save();
    res.json({ subscription: publicSub(sub) });
  }),
);

/**
 * Cancel the subscription. A paid plan with time left on the period is
 * scheduled to cancel at period end — the creator keeps their plan (no refund)
 * until `currentPeriodEnd`, then it lapses to free and won't renew. Free plans
 * (or a paid plan with no remaining period) cancel immediately.
 */
subscriptionRouter.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const sub = await getOrCreate(req.user!.id);
    const isPaid = PLANS[normalizePlan(sub.plan)].tier !== 'free';
    const periodLeft = sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > Date.now();

    if (isPaid && periodLeft && sub.status === 'active') {
      sub.cancelAtPeriodEnd = true; // keep access until period end, no refund
    } else {
      sub.status = 'canceled';
      sub.cancelAtPeriodEnd = false;
    }
    await sub.save();
    res.json({ subscription: publicSub(sub) });
  }),
);

/** Undo a scheduled cancellation (before the period ends). */
subscriptionRouter.post(
  '/resume',
  asyncHandler(async (req, res) => {
    const sub = await getOrCreate(req.user!.id);
    if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > Date.now()) {
      sub.cancelAtPeriodEnd = false;
      sub.status = 'active';
      await sub.save();
    }
    res.json({ subscription: publicSub(sub) });
  }),
);
