import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Commission earned when a sale is attributed to an affiliate (`?aff=` on checkout).
 * Payouts to affiliates are tracked here (manual mark-paid until automated payouts exist).
 */
const affiliateCommissionSchema = new Schema(
  {
    /** Product owner (creator who made the sale). */
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    /** Affiliate user resolved from `affiliateRef` (store username). */
    affiliateUserId: { type: Types.ObjectId, ref: 'User', index: true },
    affiliateRef: { type: String, required: true, trim: true, lowercase: true },

    orderId: { type: Types.ObjectId, ref: 'Order', required: true, unique: true },
    productId: { type: Types.ObjectId, ref: 'Product', required: true },
    productTitle: { type: String, default: '' },
    buyerEmail: { type: String, required: true, lowercase: true },

    grossCents: { type: Number, required: true },
    commissionPercent: { type: Number, required: true },
    commissionCents: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true },

    status: { type: String, enum: ['pending', 'paid', 'void'], default: 'pending', index: true },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

affiliateCommissionSchema.index({ affiliateUserId: 1, createdAt: -1 });

export type AffiliateCommission = InferSchemaType<typeof affiliateCommissionSchema>;
export type AffiliateCommissionDoc = HydratedDocument<AffiliateCommission>;

export const AffiliateCommissionModel = model('AffiliateCommission', affiliateCommissionSchema);
