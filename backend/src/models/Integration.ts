import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A third-party integration connection for a creator (one row per provider).
 * Tokens would be stored here once real provider OAuth is configured; today the
 * connection is established through an in-app authorize step and persisted so
 * the connected state survives reloads and drives feature behaviour.
 */
export const INTEGRATION_PROVIDERS = ['instagram', 'tiktok', 'google_calendar', 'zoom', 'zapier'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

const integrationSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
    status: { type: String, enum: ['disconnected', 'pending', 'connected'], default: 'disconnected' },
    accountName: { type: String, default: '' },
    connectedAt: { type: Date },
    // Provider-side account id used to map inbound webhooks back to a creator
    // (e.g. the Instagram business account id). Indexed for webhook lookups.
    externalAccountId: { type: String, default: '', index: true },
    // For Instagram: the linked Facebook Page id whose token authorizes sends.
    pageId: { type: String, default: '' },
    // OAuth tokens (select:false so they never leak by default).
    accessToken: { type: String, default: '', select: false },
    refreshToken: { type: String, default: '', select: false },
    tokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);
integrationSchema.index({ creatorId: 1, provider: 1 }, { unique: true });

export type Integration = InferSchemaType<typeof integrationSchema>;
export type IntegrationDoc = HydratedDocument<Integration>;
export const IntegrationModel = model('Integration', integrationSchema);
