import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const EVENT_TYPES = [
  'view',
  'cta_click',
  'product_click',
  'checkout_start',
  'lead_submit',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Lightweight storefront analytics event, tenant-scoped. Aggregated into the
 * creator's conversion funnel. Kept deliberately minimal; high-volume analytics
 * would move to a dedicated store later.
 */
const analyticsEventSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    productId: { type: Types.ObjectId, ref: 'Product' },
    // Coarse anonymous visitor hint (hashed client id), not PII.
    anonId: { type: String, default: '' },
    path: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

analyticsEventSchema.index({ creatorId: 1, type: 1, createdAt: -1 });

export type AnalyticsEvent = InferSchemaType<typeof analyticsEventSchema>;
export type AnalyticsEventDoc = HydratedDocument<AnalyticsEvent>;

export const AnalyticsEventModel = model('AnalyticsEvent', analyticsEventSchema);
