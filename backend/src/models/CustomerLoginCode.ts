import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A short-lived, hashed one-time code for passwordless customer-portal login.
 * Scoped to (creatorId, email): a buyer signs in to the specific creator's
 * store whose products they bought. Codes are single-use and expire quickly; a
 * TTL index reaps them automatically.
 */
const customerLoginCodeSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Auto-delete codes once expired.
customerLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CustomerLoginCode = InferSchemaType<typeof customerLoginCodeSchema>;
export type CustomerLoginCodeDoc = HydratedDocument<CustomerLoginCode>;

export const CustomerLoginCodeModel = model('CustomerLoginCode', customerLoginCodeSchema);
