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
