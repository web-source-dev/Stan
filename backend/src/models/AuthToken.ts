import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AUTH_TOKEN_TYPES = ['email_verify', 'password_reset', 'two_factor'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

/**
 * Server-side single-use tokens for email verification and password reset.
 * Only a SHA-256 hash of the token is stored; the raw token lives only in the
 * email link. The TTL index removes documents automatically once expired.
 */
const authTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: AUTH_TOKEN_TYPES, required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

// TTL index: Mongo removes the document shortly after expiresAt passes.
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthToken = InferSchemaType<typeof authTokenSchema>;
export type AuthTokenDoc = HydratedDocument<AuthToken>;

export const AuthTokenModel = model('AuthToken', authTokenSchema);
