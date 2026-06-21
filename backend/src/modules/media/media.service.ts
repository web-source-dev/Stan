import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { MediaModel, type MediaDoc } from '../../models/Media';
import { MediaFolderModel } from '../../models/MediaFolder';
import { destroyAsset, signedDeliveryUrl } from '../../lib/cloudinary';
import { recordAudit } from '../../lib/audit';
import { getStorageInfo } from '../subscription/subscription.guard';
import { env } from '../../config/env';

/** Sentinel for the GET ?folder= query meaning "root / Uncategorized" (folder===''). */
export const ROOT_FOLDER = '__root__';

export type MediaTypeFilter = 'image' | 'file' | 'all';
export type MediaSort = 'newest' | 'oldest' | 'name' | 'largest';

const RESOURCE_TYPES: Record<MediaTypeFilter, string[]> = {
  image: ['image'],
  file: ['raw', 'video'],
  all: [],
};

const SORTS: Record<MediaSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { filename: 1 },
  largest: { bytes: -1 },
};

function publicMedia(m: MediaDoc) {
  return {
    id: m.id,
    publicId: m.publicId,
    url: m.url,
    resourceType: m.resourceType,
    kind: m.kind,
    folder: m.folder,
    filename: m.filename,
    bytes: m.bytes,
    format: m.format,
    width: m.width,
    height: m.height,
    createdAt: m.get('createdAt'),
  };
}

export interface ListMediaOptions {
  type?: MediaTypeFilter;
  search?: string;
  sort?: MediaSort;
  page?: number;
  limit?: number;
  /** Folder name to filter by, ROOT_FOLDER for root, or undefined for all folders. */
  folder?: string;
}

export async function listMedia(creatorId: string, opts: ListMediaOptions = {}) {
  const type = opts.type && opts.type in RESOURCE_TYPES ? opts.type : 'all';
  const sort = opts.sort && opts.sort in SORTS ? opts.sort : 'newest';
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);

  const query: Record<string, unknown> = { creatorId };
  const resourceTypes = RESOURCE_TYPES[type];
  if (resourceTypes.length) query.resourceType = { $in: resourceTypes };
  if (opts.folder !== undefined) {
    // Root matches '' AND legacy docs with no folder field ($in [null] also
    // matches a missing field in MongoDB).
    query.folder = opts.folder === ROOT_FOLDER ? { $in: ['', null] } : opts.folder;
  }
  if (opts.search?.trim()) {
    // Escape regex metacharacters so a filename search can't throw or inject.
    const safe = opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.filename = { $regex: safe, $options: 'i' };
  }

  const [items, total, usage] = await Promise.all([
    MediaModel.find(query).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit),
    MediaModel.countDocuments(query),
    // Whole-library usage summary (unfiltered by type/search), for the footer.
    MediaModel.aggregate<{ bytes: number; count: number }>([
      { $match: { creatorId: new Types.ObjectId(creatorId) } },
      { $group: { _id: null, bytes: { $sum: '$bytes' }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    items: items.map(publicMedia),
    total,
    page,
    limit,
    hasMore: page * limit < total,
    library: { totalBytes: usage[0]?.bytes ?? 0, totalCount: usage[0]?.count ?? 0 },
  };
}

/** Total bytes + asset count currently stored by a creator. */
export async function getUsage(creatorId: string): Promise<{ usedBytes: number; count: number }> {
  const usage = await MediaModel.aggregate<{ bytes: number; count: number }>([
    { $match: { creatorId: new Types.ObjectId(creatorId) } },
    { $group: { _id: null, bytes: { $sum: '$bytes' }, count: { $sum: 1 } } },
  ]);
  return { usedBytes: usage[0]?.bytes ?? 0, count: usage[0]?.count ?? 0 };
}

/** Storage usage + quota for the media-library header and quota checks. */
export async function getStorageOverview(creatorId: string) {
  const [{ usedBytes, count }, info] = await Promise.all([
    getUsage(creatorId),
    getStorageInfo(creatorId),
  ]);
  const unlimited = info.quotaBytes === Infinity;
  return {
    usedBytes,
    count,
    tier: info.tier,
    baseBytes: info.baseBytes,
    extraBytes: info.extraBytes,
    quotaBytes: unlimited ? null : info.quotaBytes,
    unlimited,
    remainingBytes: unlimited ? null : Math.max(0, info.quotaBytes - usedBytes),
  };
}

/** Update a media item's filename and/or move it to another folder ('' = root). */
export async function updateMedia(
  creatorId: string,
  id: string,
  patch: { filename?: string; folder?: string },
) {
  const set: Record<string, string> = {};
  if (patch.filename !== undefined) set.filename = patch.filename.trim().slice(0, 300);
  if (patch.folder !== undefined) set.folder = patch.folder.trim().slice(0, 120);
  const media = await MediaModel.findOneAndUpdate({ _id: id, creatorId }, { $set: set }, { new: true });
  if (!media) throw AppError.notFound('Media not found');
  return publicMedia(media);
}

/**
 * A delivery URL for previewing/downloading one asset the creator owns.
 *
 * Raw documents (PDF/ZIP/etc.) are served through a signed download URL because
 * Cloudinary blocks plain public delivery of PDFs and ZIPs by default — the
 * bare `res.cloudinary.com/...pdf` URL 401s. Images/videos deliver fine, so
 * those return the stored URL as-is. The signed URL is time-limited.
 */
export async function getMediaFileUrl(creatorId: string, id: string): Promise<{ url: string; resourceType: string }> {
  const media = await MediaModel.findOne({ _id: id, creatorId });
  if (!media) throw AppError.notFound('Media not found');
  const url =
    media.resourceType === 'raw' && env.cloudinaryConfigured
      ? signedDeliveryUrl(media.publicId, 'raw', 600)
      : media.url;
  return { url, resourceType: media.resourceType };
}

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

/** Named folders (with media counts) + root/total counts for the folder bar. */
export async function listFolders(creatorId: string) {
  const [folders, counts] = await Promise.all([
    MediaFolderModel.find({ creatorId }).sort({ name: 1 }),
    MediaModel.aggregate<{ _id: string; count: number }>([
      { $match: { creatorId: new Types.ObjectId(creatorId) } },
      { $group: { _id: '$folder', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(counts.map((c) => [c._id ?? '', c.count]));
  const named = folders.map((f) => ({ id: f.id, name: f.name, count: countMap.get(f.name) ?? 0 }));
  const totalCount = [...countMap.values()].reduce((a, b) => a + b, 0);
  return { folders: named, rootCount: countMap.get('') ?? 0, totalCount };
}

export async function createFolder(creatorId: string, name: string) {
  const clean = name.trim().slice(0, 120);
  if (!clean) throw AppError.badRequest('Folder name is required');
  const existing = await MediaFolderModel.findOne({ creatorId, name: clean });
  if (existing) throw new AppError(409, 'folder_exists', 'A folder with that name already exists');
  const folder = await MediaFolderModel.create({ creatorId, name: clean });
  return { id: folder.id, name: folder.name, count: 0 };
}

export async function renameFolder(creatorId: string, id: string, name: string) {
  const clean = name.trim().slice(0, 120);
  if (!clean) throw AppError.badRequest('Folder name is required');
  const folder = await MediaFolderModel.findOne({ _id: id, creatorId });
  if (!folder) throw AppError.notFound('Folder not found');
  if (clean !== folder.name) {
    const clash = await MediaFolderModel.findOne({ creatorId, name: clean });
    if (clash) throw new AppError(409, 'folder_exists', 'A folder with that name already exists');
    const oldName = folder.name;
    folder.name = clean;
    await folder.save();
    // Re-point every asset that lived in the old folder.
    await MediaModel.updateMany({ creatorId, folder: oldName }, { $set: { folder: clean } });
  }
  const count = await MediaModel.countDocuments({ creatorId, folder: clean });
  return { id: folder.id, name: folder.name, count };
}

/** Delete a folder; its media fall back to root (not deleted). */
export async function deleteFolder(creatorId: string, id: string): Promise<void> {
  const folder = await MediaFolderModel.findOne({ _id: id, creatorId });
  if (!folder) throw AppError.notFound('Folder not found');
  await MediaModel.updateMany({ creatorId, folder: folder.name }, { $set: { folder: '' } });
  await folder.deleteOne();
}

export interface RecordMediaInput {
  publicId: string;
  url: string;
  resourceType?: 'image' | 'video' | 'raw';
  kind?: string;
  folder?: string;
  filename?: string;
  bytes?: number;
  format?: string;
  width?: number;
  height?: number;
}

/**
 * Record an uploaded asset in the creator's library. Idempotent on
 * (creatorId, publicId) — re-recording the same asset returns the existing row.
 */
export async function recordMedia(creatorId: string, input: RecordMediaInput) {
  if (!input.publicId || !input.url) {
    throw AppError.badRequest('publicId and url are required');
  }

  // Idempotent: a re-record of an already-stored asset is a no-op and must not
  // be counted against the quota again.
  const existing = await MediaModel.findOne({ creatorId, publicId: input.publicId });
  if (existing) return publicMedia(existing);

  // New asset: enforce the storage quota. This is the authoritative checkpoint
  // (the upload itself goes client→Cloudinary). If it would exceed the quota we
  // delete the just-uploaded orphan from Cloudinary and refuse to record it.
  const incoming = input.bytes ?? 0;
  const [{ usedBytes }, info] = await Promise.all([getUsage(creatorId), getStorageInfo(creatorId)]);
  if (info.quotaBytes !== Infinity && usedBytes + incoming > info.quotaBytes) {
    await destroyAsset(input.publicId, input.resourceType ?? 'image').catch(() => {});
    throw new AppError(
      403,
      'storage_exceeded',
      'This upload would exceed your storage limit. Free up space or buy more storage.',
      { used: usedBytes, incoming, quota: info.quotaBytes, tier: info.tier },
    );
  }

  // upsert (not create) to stay safe against a concurrent record of the same asset.
  const media = await MediaModel.findOneAndUpdate(
    { creatorId, publicId: input.publicId },
    {
      $setOnInsert: {
        creatorId,
        publicId: input.publicId,
        url: input.url,
        resourceType: input.resourceType ?? 'image',
        kind: input.kind ?? '',
        folder: input.folder ?? '',
        filename: input.filename ?? '',
        bytes: incoming,
        format: input.format ?? '',
        width: input.width,
        height: input.height,
      },
    },
    { new: true, upsert: true },
  );
  return publicMedia(media);
}

export async function deleteMedia(creatorId: string, id: string): Promise<void> {
  const media = await MediaModel.findOne({ _id: id, creatorId });
  if (!media) throw AppError.notFound('Media not found');
  await destroyAsset(media.publicId, media.resourceType);
  await media.deleteOne();
  recordAudit({
    action: 'media.deleted',
    actorId: creatorId,
    actorType: 'user',
    creatorId,
    targetType: 'media',
    targetId: id,
  });
}
