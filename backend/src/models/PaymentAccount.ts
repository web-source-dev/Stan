import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A creator's Stripe Connect (Express) account. Per the PRD decision, Connect is
 * core: end-customer payments settle to the creator's connected account and the
 * platform takes an application fee. A creator cannot publish a *paid* offer
 * until `chargesEnabled` is true.
 */
const paymentAccountSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    provider: { type: String, enum: ['stripe'], default: 'stripe' },
    stripeAccountId: { type: String, index: true },

    // Mirrored from Stripe account status; refreshed on return from onboarding
    // and via account.updated webhooks.
    chargesEnabled: { type: Boolean, default: false },
    payoutsEnabled: { type: Boolean, default: false },
    detailsSubmitted: { type: Boolean, default: false },
    requirementsDue: { type: [String], default: [] },

    onboardingStatus: {
      type: String,
      enum: ['not_started', 'pending', 'complete', 'restricted'],
      default: 'not_started',
    },
  },
  { timestamps: true },
);

export type PaymentAccount = InferSchemaType<typeof paymentAccountSchema>;
export type PaymentAccountDoc = HydratedDocument<PaymentAccount>;

export const PaymentAccountModel = model('PaymentAccount', paymentAccountSchema);
