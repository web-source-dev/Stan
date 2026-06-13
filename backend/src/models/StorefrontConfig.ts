import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Theme + block ordering for a creator's storefront. Kept separate from the
 * profile so the public read model (theme + blocks) can be cached and evolved
 * independently of identity data.
 */
const blockSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        // Profile + offer sections
        'header',
        'featured',
        'product',
        'course',
        'booking',
        'leadMagnet',
        'emailCapture',
        'links',
        // Rich content sections
        'hero',
        'testimonial',
        'faq',
        'gallery',
        // Free-form content blocks (full builder)
        'heading',
        'text',
        'button',
        'image',
        'divider',
      ],
      required: true,
    },
    // Loose payload; each block type interprets its own config on the client.
    config: { type: Schema.Types.Mixed, default: {} },
    visible: { type: Boolean, default: true },
  },
  { _id: false },
);

const themeSchema = new Schema(
  {
    fontPair: { type: String, default: 'default' },
    buttonStyle: { type: String, enum: ['solid', 'outline', 'soft'], default: 'solid' },
    cardStyle: { type: String, enum: ['flat', 'shadow', 'border'], default: 'shadow' },
    background: { type: String, default: '#faf9ff' },
    accent: { type: String, default: '#6355ff' },
    // Secondary accent for two-tone banners + mesh/gradient backgrounds.
    accent2: { type: String, default: '' },
    // How the page background is painted.
    backgroundStyle: { type: String, enum: ['solid', 'gradient', 'mesh'], default: 'solid' },
    spacing: { type: String, enum: ['compact', 'comfortable', 'airy'], default: '' },
    cardChrome: { type: String, enum: ['elevated', 'flat', 'glass'], default: '' },
    motion: { type: String, enum: ['none', 'subtle', 'expressive'], default: '' },
    // Id of the last-applied design template (drives the active highlight in the
    // builder). Empty when the creator started from scratch.
    templateId: { type: String, default: '' },
  },
  { _id: false },
);

const storefrontConfigSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    theme: { type: themeSchema, default: () => ({}) },
    blocks: { type: [blockSchema], default: [] },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      ogImageUrl: { type: String, default: '' },
    },
  },
  { timestamps: true },
);

export type StorefrontConfig = InferSchemaType<typeof storefrontConfigSchema>;
export type StorefrontConfigDoc = HydratedDocument<StorefrontConfig>;

export const StorefrontConfigModel = model('StorefrontConfig', storefrontConfigSchema);
