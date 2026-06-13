import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One row per issued refresh token (identified by its `jti`). Refresh tokens
 * are rotated on every use: the old session is marked replaced and a new one is
 * created. A presented refresh token is only honoured if its session exists and
 * is neither revoked nor already replaced — this gives multi-device session
 * awareness and a concrete revocation/denylist mechanism. TTL clears expired
 * rows automatically.
 */
const refreshSessionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByJti: { type: String },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshSession = InferSchemaType<typeof refreshSessionSchema>;
export type RefreshSessionDoc = HydratedDocument<RefreshSession>;

export const RefreshSessionModel = model('RefreshSession', refreshSessionSchema);
