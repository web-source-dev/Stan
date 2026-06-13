import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A private landing page — a standalone, unlisted page that drives customers to
 * a specific product/offer. Hidden from the storefront; reached only via its
 * slug at /{username}/p/{slug}.
 */
const landingPageSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    headline: { type: String, default: '', maxlength: 200 },
    body: { type: String, default: '', maxlength: 10000 },
    productId: { type: Types.ObjectId, ref: 'Product' },
    ctaLabel: { type: String, default: 'Get access' },
    published: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

landingPageSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

export type LandingPage = InferSchemaType<typeof landingPageSchema>;
export type LandingPageDoc = HydratedDocument<LandingPage>;
export const LandingPageModel = model('LandingPage', landingPageSchema);
