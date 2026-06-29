import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A buyer's active (or past) subscription to a creator's membership product.
 * Keyed by stripeSubscriptionId for idempotent webhook handling.
 */
const buyerMembershipSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Types.ObjectId, ref: 'Product', required: true, index: true },
    buyerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },

    stripeSubscriptionId: { type: String, required: true, unique: true },
    stripeCustomerId: { type: String, default: '' },
    stripeCheckoutSessionId: { type: String, default: '' },
    stripeAccountId: { type: String, default: '' },

    billingInterval: { type: String, enum: ['month', 'year'], required: true },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid'],
      default: 'active',
      index: true,
    },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    currentPeriodEnd: { type: Date },
    canceledAt: { type: Date },

    entitlementId: { type: Types.ObjectId, ref: 'Entitlement' },

    /** membership = ongoing access; payment_plan = fixed installments then keep access. */
    planType: { type: String, enum: ['membership', 'payment_plan'], default: 'membership' },
    installmentsTotal: { type: Number, default: 0, min: 0 },
    installmentsPaid: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

buyerMembershipSchema.index({ buyerEmail: 1, productId: 1 }, { unique: true });

export type BuyerMembership = InferSchemaType<typeof buyerMembershipSchema>;
export type BuyerMembershipDoc = HydratedDocument<BuyerMembership>;

export const BuyerMembershipModel = model('BuyerMembership', buyerMembershipSchema);
