import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A captured contact for a creator. Per the PRD, the email data model is built
 * around contacts + segments + topics (Resend audiences are deprecated). A Lead
 * is the contact record; segments are derived at send time. Deduped per tenant
 * by (creatorId, email).
 */
const leadSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },

    source: {
      type: String,
      enum: ['storefront', 'product', 'checkout', 'import', 'other'],
      default: 'storefront',
    },
    utm: {
      source: { type: String, default: '' },
      medium: { type: String, default: '' },
      campaign: { type: String, default: '' },
    },
    tags: { type: [String], default: [] },

    consent: { type: Boolean, default: false },
    // For double opt-in flows; 'confirmed' contacts are emailable.
    optInStatus: { type: String, enum: ['pending', 'confirmed'], default: 'confirmed' },

    // Set true when the contact has also made a purchase (denormalised flag).
    isCustomer: { type: Boolean, default: false },

    unsubscribedAt: { type: Date },
  },
  { timestamps: true },
);

leadSchema.index({ creatorId: 1, email: 1 }, { unique: true });

export type Lead = InferSchemaType<typeof leadSchema>;
export type LeadDoc = HydratedDocument<Lead>;

export const LeadModel = model('Lead', leadSchema);
