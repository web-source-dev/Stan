import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A creator's referral program record. One per creator. `code` is the shareable
 * referral identifier; commission accrues at a flat lifetime rate on referred
 * creators' subscription revenue (tracked here as a denormalised total).
 */
const referralSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, trim: true },
    commissionRate: { type: Number, default: 0.2 }, // 20% lifetime
    clicks: { type: Number, default: 0 },
    signups: { type: Number, default: 0 },
    referredEmails: { type: [String], default: [] },
    earningsCents: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type Referral = InferSchemaType<typeof referralSchema>;
export type ReferralDoc = HydratedDocument<Referral>;
export const ReferralModel = model('Referral', referralSchema);
