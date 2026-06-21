import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const PRODUCT_TYPES = ['digital', 'lead_magnet'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/**
 * A downloadable fulfilment file stored in Cloudinary. For paid products these
 * are uploaded as `raw`/private and delivered via signed, time-limited URLs.
 */
const productAssetSchema = new Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['raw', 'image', 'video'], default: 'raw' },
    filename: { type: String, required: true },
    bytes: { type: Number, default: 0 },
    format: { type: String, default: '' },
  },
  { _id: true },
);

const productReviewSchema = new Schema(
  {
    author: { type: String, required: true, trim: true, maxlength: 80 },
    quote: { type: String, required: true, trim: true, maxlength: 500 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    avatarUrl: { type: String, maxlength: 1000, default: '' },
  },
  { _id: true },
);

const productEmailFlowStepSchema = new Schema(
  {
    dayOffset: { type: Number, required: true, min: 0, max: 365 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    enabled: { type: Boolean, default: true },
  },
  { _id: true },
);

const productDiscountCodeSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    value: { type: Number, required: true, min: 1 },
  },
  { _id: true },
);

const productCustomFieldSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ['text', 'textarea', 'phone'], default: 'text' },
    required: { type: Boolean, default: false },
  },
  { _id: true },
);

/**
 * A sellable digital product. Price is stored in minor units (cents). A
 * `lead_magnet` is a free product used for list building; everything else
 * requires payment + a connected Stripe account to publish.
 */
const productSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: PRODUCT_TYPES, default: 'digital' },

    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    shortDescription: { type: String, maxlength: 300, default: '' },
    description: { type: String, maxlength: 5000, default: '' },

    priceCents: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'usd', lowercase: true },

    coverImageUrl: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },

    assets: { type: [productAssetSchema], default: [] },

    ctaLabel: { type: String, default: '' },
    thankYouMessage: { type: String, maxlength: 1000, default: '' },

    /** UI product kind slug (digital, custom, membership, etc.) */
    productKind: { type: String, default: 'digital', trim: true },
    thumbnailStyle: { type: String, enum: ['button', 'callout', 'preview', 'embed'], default: 'callout' },
    thumbnailButtonLabel: { type: String, maxlength: 80, default: '' },
    bottomTitle: { type: String, maxlength: 140, default: '' },
    discountPriceCents: { type: Number, default: 0, min: 0 },
    /** Billing cadence — one_time for products, month/year for memberships. */
    billingInterval: { type: String, enum: ['one_time', 'month', 'year'], default: 'one_time' },
    /** When true, subscription auto-cancels after cancelAfterMonths (0 = ongoing). */
    cancelSubscriptionEnabled: { type: Boolean, default: false },
    cancelAfterMonths: { type: Number, default: 0, min: 0, max: 120 },
    /** For custom products: turnaround/delivery promise shown at checkout. */
    fulfilmentNote: { type: String, maxlength: 280, default: '' },
    /** For community/membership: external access link (Discord, Circle, etc.). */
    accessUrl: { type: String, maxlength: 1000, default: '' },
    deliveryMode: { type: String, enum: ['file', 'url'], default: 'file' },
    /** When false, buyers can only PREVIEW fulfilment files (no download). */
    allowDownload: { type: Boolean, default: false },
    redirectUrl: { type: String, maxlength: 1000, default: '' },
    confirmSubject: { type: String, maxlength: 200, default: '' },
    confirmBody: { type: String, maxlength: 5000, default: '' },

    reviewsEnabled: { type: Boolean, default: false },
    reviews: { type: [productReviewSchema], default: [] },
    emailFlows: { type: [productEmailFlowStepSchema], default: [] },
    orderBumpEnabled: { type: Boolean, default: false },
    orderBumpTitle: { type: String, maxlength: 140, default: '' },
    orderBumpDescription: { type: String, maxlength: 500, default: '' },
    orderBumpPriceCents: { type: Number, default: 0, min: 0 },
    affiliateEnabled: { type: Boolean, default: false },
    affiliateCommissionPercent: { type: Number, default: 20, min: 1, max: 90 },
    paymentPlanEnabled: { type: Boolean, default: false },
    paymentPlanInstallments: { type: Number, default: 3, min: 2, max: 12 },
    discountCodes: { type: [productDiscountCodeSchema], default: [] },
    quantityLimit: { type: Number, default: 0, min: 0 },
    customFields: { type: [productCustomFieldSchema], default: [] },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    visibility: { type: String, enum: ['public', 'unlisted'], default: 'public' },

    // Lightweight denormalised counters for the dashboard.
    salesCount: { type: Number, default: 0 },
    grossCents: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Tenant-local unique slug.
productSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

export type Product = InferSchemaType<typeof productSchema>;
export type ProductDoc = HydratedDocument<Product>;

export const ProductModel = model('Product', productSchema);
