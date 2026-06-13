import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * The creator's own subscription to the platform (distinct from their customers'
 * purchases). Drives Billing in Settings. Stripe is the source of truth in
 * production; this mirrors the active plan + trial window for the dashboard.
 */
export const PLAN_PRICES: Record<string, { cents: number; interval: 'month' | 'year'; label: string }> = {
  monthly: { cents: 2900, interval: 'month', label: 'Creator' },
  yearly: { cents: 30000, interval: 'year', label: 'Creator (Yearly)' },
  bundle: { cents: 4900, interval: 'month', label: 'Creator + Stanley AI' },
};

const subscriptionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    plan: { type: String, enum: ['monthly', 'yearly', 'bundle'], default: 'monthly' },
    status: { type: String, enum: ['trialing', 'active', 'canceled', 'past_due'], default: 'trialing' },
    trialEndsAt: { type: Date },
    currentPeriodEnd: { type: Date },
    stanleyAddon: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type Subscription = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionDoc = HydratedDocument<Subscription>;
export const SubscriptionModel = model('Subscription', subscriptionSchema);
