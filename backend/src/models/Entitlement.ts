import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

import crypto from 'node:crypto';

/**
 * Access right granted to a buyer for a product. Keyed by (buyerEmail,
 * productId) so repeat purchases don't duplicate access. `accessToken` is an
 * unguessable handle emailed to the buyer that backs the fulfilment/download
 * page (buyers are not authenticated accounts).
 */
const entitlementSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Types.ObjectId, ref: 'Product', required: true },
    orderId: { type: Types.ObjectId, ref: 'Order', required: true },

    buyerEmail: { type: String, required: true, lowercase: true, trim: true },
    type: { type: String, enum: ['download', 'course'], default: 'download' },

    accessToken: { type: String, required: true, unique: true, default: () => crypto.randomBytes(32).toString('base64url') },
    revokedAt: { type: Date },

    grantedAt: { type: Date, default: Date.now },
    lastAccessedAt: { type: Date },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

entitlementSchema.index({ buyerEmail: 1, productId: 1 }, { unique: true });

export type Entitlement = InferSchemaType<typeof entitlementSchema>;
export type EntitlementDoc = HydratedDocument<Entitlement>;

export const EntitlementModel = model('Entitlement', entitlementSchema);
