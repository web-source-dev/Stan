import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { MediaModel, type MediaDoc } from '../../models/Media';
import { destroyAsset } from '../../lib/cloudinary';
import { recordAudit } from '../../lib/audit';

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
}

export async function listMedia(creatorId: string, opts: ListMediaOptions = {}) {
  const type = opts.type && opts.type in RESOURCE_TYPES ? opts.type : 'all';
  const sort = opts.sort && opts.sort in SORTS ? opts.sort : 'newest';
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);

  const query: Record<string, unknown> = { creatorId };
  const resourceTypes = RESOURCE_TYPES[type];
  if (resourceTypes.length) query.resourceType = { $in: resourceTypes };
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

export async function renameMedia(creatorId: string, id: string, filename: string) {
  const media = await MediaModel.findOneAndUpdate(
    { _id: id, creatorId },
    { $set: { filename: filename.trim().slice(0, 300) } },
    { new: true },
  );
  if (!media) throw AppError.notFound('Media not found');
  return publicMedia(media);
}

export interface RecordMediaInput {
  publicId: string;
  url: string;
  resourceType?: 'image' | 'video' | 'raw';
  kind?: string;
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
  const media = await MediaModel.findOneAndUpdate(
    { creatorId, publicId: input.publicId },
    {
      $setOnInsert: {
        creatorId,
        publicId: input.publicId,
        url: input.url,
        resourceType: input.resourceType ?? 'image',
        kind: input.kind ?? '',
        filename: input.filename ?? '',
        bytes: input.bytes ?? 0,
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
