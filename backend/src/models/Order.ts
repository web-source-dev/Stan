import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A commercial record tied to a Stripe Checkout Session. Fulfilment (entitlement
 * grant + emails) is driven from webhook-confirmed payment, never from the
 * browser redirect. The unique stripeCheckoutSessionId makes order creation
 * idempotent across webhook retries.
 */
const orderSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Types.ObjectId, ref: 'Product', required: true, index: true },

    buyerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },

    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true },
    applicationFeeCents: { type: Number, default: 0 },

    stripeCheckoutSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String },
    stripeAccountId: { type: String },

    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
      index: true,
    },
    fulfilmentStatus: {
      type: String,
      enum: ['pending', 'fulfilled', 'failed'],
      default: 'pending',
    },

    // Attribution captured at checkout-session creation.
    source: { type: String, default: '' },
    campaign: { type: Schema.Types.Mixed, default: {} },

    paidAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true },
);

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderDoc = HydratedDocument<Order>;

export const OrderModel = model('Order', orderSchema);
