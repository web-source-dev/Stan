import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * The creator's own subscription to the platform (distinct from their customers'
 * purchases). Drives Billing in Settings + feature gating across the app. Stripe
 * is the source of truth in production; this mirrors the active plan + trial
 * window for the dashboard.
 *
 * Tiers: free → pro → premium. Each tier maps to a feature set (PLAN_FEATURES);
 * `pro`/`premium` are billable monthly or yearly. Trials grant their tier's
 * features until they expire, after which the effective tier falls back to free.
 */
export type PlanTier = 'free' | 'pro' | 'premium';

export interface PlanInfo {
  tier: PlanTier;
  cents: number;
  interval: 'month' | 'year';
  label: string;
}

/** Every selectable plan, keyed by the value stored on the subscription. */
export const PLANS = {
  free: { tier: 'free', cents: 0, interval: 'month', label: 'Free' },
  pro_monthly: { tier: 'pro', cents: 2900, interval: 'month', label: 'Pro' },
  pro_yearly: { tier: 'pro', cents: 30000, interval: 'year', label: 'Pro' },
  premium_monthly: { tier: 'premium', cents: 4900, interval: 'month', label: 'Premium' },
  premium_yearly: { tier: 'premium', cents: 49000, interval: 'year', label: 'Premium' },
} satisfies Record<string, PlanInfo>;

export type PlanKey = keyof typeof PLANS;

/** Byte helpers for storage quotas. */
export const MB = 1024 * 1024;
export const GB = 1024 * MB;

/**
 * One-time storage add-on packs a creator can buy to permanently extend their
 * library quota beyond the tier baseline. Purchases accumulate on
 * `subscription.extraStorageBytes`.
 */
export const STORAGE_PACKS = {
  gb5: { bytes: 5 * GB, cents: 900, label: '5 GB' },
  gb20: { bytes: 20 * GB, cents: 2900, label: '20 GB' },
  gb80: { bytes: 80 * GB, cents: 9900, label: '80 GB' },
} satisfies Record<string, { bytes: number; cents: number; label: string }>;

export type StoragePackKey = keyof typeof STORAGE_PACKS;

/** What each tier unlocks. `maxProducts: null` means unlimited. */
export interface PlanFeatures {
  // Modules / sections
  maxProducts: number | null;
  // Media-library storage included with the tier, in bytes (`null` = unlimited).
  // Effective quota = maxStorageBytes + subscription.extraStorageBytes (packs).
  maxStorageBytes: number | null;
  courses: boolean;
  bookings: boolean;
  email: boolean;
  landingPages: boolean;
  autodm: boolean;
  stanleyAI: boolean;
  removeBranding: boolean;
  // Granular in-product monetization tools (gated inside the product editor)
  pricingTools: boolean; // discount price/codes, payment plans, quantity limits
  orderBumps: boolean;
  customFields: boolean;
  affiliate: boolean;
  // Reporting
  advancedAnalytics: boolean; // leads, geo, conversion funnel, custom date ranges
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    maxProducts: 1,
    maxStorageBytes: 500 * MB,
    courses: false,
    bookings: false,
    email: false,
    landingPages: false,
    autodm: false,
    stanleyAI: false,
    removeBranding: false,
    pricingTools: false,
    orderBumps: false,
    customFields: false,
    affiliate: false,
    advancedAnalytics: false,
  },
  pro: {
    maxProducts: null,
    maxStorageBytes: 5 * GB,
    courses: true,
    bookings: true,
    email: true,
    landingPages: true,
    autodm: false,
    stanleyAI: false,
    removeBranding: true,
    pricingTools: true,
    orderBumps: true,
    customFields: true,
    affiliate: false,
    advancedAnalytics: true,
  },
  premium: {
    maxProducts: null,
    maxStorageBytes: 10 * GB,
    courses: true,
    bookings: true,
    email: true,
    landingPages: true,
    autodm: true,
    stanleyAI: true,
    removeBranding: true,
    pricingTools: true,
    orderBumps: true,
    customFields: true,
    affiliate: true,
    advancedAnalytics: true,
  },
};

/** Map legacy plan values (and anything unknown) onto a current plan key. */
export function normalizePlan(plan: string | undefined | null): PlanKey {
  if (plan && plan in PLANS) return plan as PlanKey;
  switch (plan) {
    case 'monthly':
      return 'pro_monthly';
    case 'yearly':
      return 'pro_yearly';
    case 'bundle':
      return 'premium_monthly';
    default:
      return 'free';
  }
}

/**
 * The tier whose features actually apply right now: the plan's tier while active
 * or inside a live trial, otherwise free (trial lapsed / canceled).
 */
export function effectiveTier(sub: {
  plan?: string;
  status?: string;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
}): PlanTier {
  const tier = PLANS[normalizePlan(sub.plan)].tier;
  if (sub.status === 'active') {
    // Scheduled-to-cancel: keep the paid tier until the paid period ends, then free.
    if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= Date.now()) return 'free';
    return tier;
  }
  if (sub.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt.getTime() > Date.now()) return tier;
  return 'free';
}

const subscriptionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    // Stored as a free-form string (validated against PLANS at the route layer)
    // so legacy values load without an enum-cast failure; normalizePlan maps them.
    plan: { type: String, default: 'pro_monthly' },
    status: { type: String, enum: ['trialing', 'active', 'canceled', 'past_due'], default: 'trialing' },
    trialEndsAt: { type: Date },
    currentPeriodEnd: { type: Date },
    // Scheduled cancellation: the paid plan stays active (no refund) until
    // currentPeriodEnd, then lapses to free. Cleared on resume / re-subscribe.
    cancelAtPeriodEnd: { type: Boolean, default: false },
    stanleyAddon: { type: Boolean, default: false },
    // Permanent extra media storage bought via one-time STORAGE_PACKS purchases,
    // added on top of the tier's maxStorageBytes baseline.
    extraStorageBytes: { type: Number, default: 0 },

    // MASKED card on file for display only. The full PAN and CVC are NEVER sent
    // to or stored on the server (PCI) — only the brand + last 4 + expiry, which
    // is exactly what a tokenized card (Stripe) exposes for display.
    paymentMethod: {
      brand: { type: String, default: '' },
      last4: { type: String, default: '' },
      expMonth: { type: Number, default: 0 },
      expYear: { type: Number, default: 0 },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true },
);

/**
 * The creator's effective media-storage quota in bytes: the tier baseline plus
 * any purchased extra-storage packs. Returns Infinity when the tier is unlimited.
 */
export function storageQuotaBytes(features: PlanFeatures, extraStorageBytes = 0): number {
  if (features.maxStorageBytes === null) return Infinity;
  return features.maxStorageBytes + Math.max(0, extraStorageBytes);
}

export type Subscription = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionDoc = HydratedDocument<Subscription>;
export const SubscriptionModel = model('Subscription', subscriptionSchema);
