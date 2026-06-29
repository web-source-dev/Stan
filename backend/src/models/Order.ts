import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const orderFulfillmentAssetSchema = new Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['raw', 'image', 'video'], default: 'raw' },
    filename: { type: String, required: true },
    bytes: { type: Number, default: 0 },
    format: { type: String, default: '' },
  },
  { _id: true },
);

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
    buyerName: { type: String, default: '', trim: true },
    /** Checkout custom-field answers keyed by field label. */
    buyerCustomFields: { type: Schema.Types.Mixed, default: {} },

    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true },
    applicationFeeCents: { type: Number, default: 0 },

    // Optional + sparse-unique: paid orders carry a Stripe session (idempotency);
    // free claims have none and rely on their own dedupe in fulfilFreeProduct.
    stripeCheckoutSessionId: { type: String, unique: true, sparse: true },
    stripePaymentIntentId: { type: String },
    stripeInvoiceId: { type: String, unique: true, sparse: true },
    stripeSubscriptionId: { type: String, index: true },
    stripeAccountId: { type: String },

    /** one_time | subscription_initial | subscription_renewal */
    orderKind: { type: String, enum: ['one_time', 'subscription_initial', 'subscription_renewal'], default: 'one_time' },

    // Which rail settled this order. 'free' = $0 claim, 'manual' = imported.
    paymentProvider: { type: String, enum: ['stripe', 'paypal', 'free', 'manual'], default: 'stripe' },

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

    /** Per-order delivery for custom products (creator fulfills in dashboard). */
    fulfillmentMessage: { type: String, default: '', maxlength: 5000 },
    fulfillmentDeliveryUrl: { type: String, default: '' },
    fulfillmentAssets: { type: [orderFulfillmentAssetSchema], default: [] },
    fulfilledAt: { type: Date },

    // Attribution captured at checkout-session creation.
    source: { type: String, default: '' },
    campaign: { type: Schema.Types.Mixed, default: {} },
    // Discount code applied at checkout (surfaced in the Income filters).
    discountCode: { type: String, default: '' },

    /** Affiliate attribution from checkout `?aff=` (store username). */
    affiliateRef: { type: String, default: '', lowercase: true, trim: true },
    affiliateUserId: { type: Types.ObjectId, ref: 'User' },
    affiliateCommissionCents: { type: Number, default: 0, min: 0 },

    paidAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true },
);

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderDoc = HydratedDocument<Order>;

export const OrderModel = model('Order', orderSchema);
