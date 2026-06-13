import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const socialLinkSchema = new Schema(
  {
    platform: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'x', 'website', 'whatsapp', 'other'],
      required: true,
    },
    url: { type: String, required: true },
  },
  { _id: false },
);

/**
 * Public-facing creator presence. One per user. `username` drives the public
 * storefront route (/{username}); `slug` is reserved for any future renaming
 * scheme. The tenant boundary for all creator-owned resources is this
 * profile's `userId` (referred to elsewhere as `creatorId`).
 */
const creatorProfileSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    displayName: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    bio: { type: String, maxlength: 500, default: '' },

    // Cloudinary public IDs / URLs for profile imagery.
    avatarPublicId: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },

    socialLinks: { type: [socialLinkSchema], default: [] },

    primaryCta: {
      type: String,
      enum: ['shop', 'book', 'subscribe', 'lead', 'none'],
      default: 'none',
    },

    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

export type CreatorProfile = InferSchemaType<typeof creatorProfileSchema>;
export type CreatorProfileDoc = HydratedDocument<CreatorProfile>;

export const CreatorProfileModel = model('CreatorProfile', creatorProfileSchema);
