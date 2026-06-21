import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A named media-library folder for a creator. Folders are a thin organisational
 * layer over the flat `Media` collection: each `Media.folder` holds a folder
 * name (or '' for root). This model lets folders exist even when empty and gives
 * them a stable id for rename/delete.
 */
const mediaFolderSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);

// One folder name per creator (case-sensitive); re-create is a 409.
mediaFolderSchema.index({ creatorId: 1, name: 1 }, { unique: true });

export type MediaFolder = InferSchemaType<typeof mediaFolderSchema>;
export type MediaFolderDoc = HydratedDocument<MediaFolder>;
export const MediaFolderModel = model('MediaFolder', mediaFolderSchema);
