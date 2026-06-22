import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A pending checkout, created when a PayPal order is opened and consumed when it
 * is captured. Holds everything fulfilment needs (the Stripe-shaped metadata,
 * amount, currency, buyer email) keyed by the external provider order id, so the
 * capture step can fulfil without the original request inputs. Short-lived: a
 * TTL index reaps abandoned intents.
 */
const checkoutIntentSchema = new Schema(
  {
    provider: { type: String, enum: ['paypal'], default: 'paypal' },
    providerOrderId: { type: String, required: true, unique: true, index: true },
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['product', 'course', 'booking'], required: true },
    // Stripe-checkout-session-shaped metadata consumed by fulfilCheckoutSession.
    metadata: { type: Schema.Types.Mixed, default: {} },
    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true },
    buyerEmail: { type: String, default: '', lowercase: true, trim: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
    // Where to send the buyer after a successful capture.
    successKind: { type: String, default: 'product' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Reap abandoned intents ~3h after creation.
checkoutIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CheckoutIntent = InferSchemaType<typeof checkoutIntentSchema>;
export type CheckoutIntentDoc = HydratedDocument<CheckoutIntent>;

export const CheckoutIntentModel = model('CheckoutIntent', checkoutIntentSchema);
