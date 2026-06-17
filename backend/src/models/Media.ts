import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A reusable media asset in a creator's library. Every signed upload (cover
 * images, fulfilment files, avatars, etc.) is recorded here so it can be picked
 * again from the media library instead of re-uploading. The binary lives in
 * Cloudinary; this row holds the metadata and the `publicId` needed to render or
 * delete it.
 */
const mediaSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    // Cloudinary resource type — drives both delivery and the library's filters.
    resourceType: { type: String, enum: ['image', 'video', 'raw'], default: 'image', index: true },
    // The logical upload purpose (matches the sign-upload "kind"), kept for
    // folder context and analytics.
    kind: { type: String, default: '' },
    filename: { type: String, default: '' },
    bytes: { type: Number, default: 0 },
    format: { type: String, default: '' },
    width: { type: Number },
    height: { type: Number },
  },
  { timestamps: true },
);

// Newest-first listing per creator.
mediaSchema.index({ creatorId: 1, createdAt: -1 });
// A given asset is recorded once per creator (idempotent re-records are a no-op).
mediaSchema.index({ creatorId: 1, publicId: 1 }, { unique: true });

export type Media = InferSchemaType<typeof mediaSchema>;
export type MediaDoc = HydratedDocument<Media>;
export const MediaModel = model('Media', mediaSchema);
