import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A billing invoice for a creator's own Stan subscription / add-on purchases
 * (the creator paying the platform). One row per charge. In demo mode these are
 * created when a paid plan or storage pack is selected; with Stripe they'd be
 * created from `invoice.paid` webhooks.
 */
const invoiceSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    number: { type: String, required: true }, // human-facing, e.g. INV-2026-0001
    kind: { type: String, enum: ['subscription', 'storage'], default: 'subscription' },
    description: { type: String, required: true }, // "Pro plan — Monthly"
    planKey: { type: String, default: '' },
    interval: { type: String, enum: ['month', 'year', 'one_time'], default: 'month' },

    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true },
    status: { type: String, enum: ['paid', 'open', 'void'], default: 'paid' },

    periodStart: { type: Date },
    periodEnd: { type: Date },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

invoiceSchema.index({ userId: 1, createdAt: -1 });

export type Invoice = InferSchemaType<typeof invoiceSchema>;
export type InvoiceDoc = HydratedDocument<Invoice>;

export const InvoiceModel = model('Invoice', invoiceSchema);
