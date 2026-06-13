import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Idempotency + replay ledger for inbound provider webhooks (Stripe, Resend).
 * The unique (provider, eventId) index guarantees a given event is processed
 * at most once even if the provider retries delivery.
 */
const webhookEventSchema = new Schema(
  {
    provider: { type: String, enum: ['stripe', 'resend'], required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    payload: { type: Schema.Types.Mixed },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export type WebhookEvent = InferSchemaType<typeof webhookEventSchema>;
export type WebhookEventDoc = HydratedDocument<WebhookEvent>;

export const WebhookEventModel = model('WebhookEvent', webhookEventSchema);
