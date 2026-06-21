import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './media.service';

// Mounted at /api/media.
export const mediaRouter = Router();
mediaRouter.use(requireAuth);

const listQuery = z.object({
  type: z.enum(['image', 'file', 'all']).optional(),
  search: z.string().max(120).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'largest']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  folder: z.string().max(120).optional(),
});

mediaRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as z.infer<typeof listQuery>;
    res.json(await service.listMedia(req.user!.id, q));
  }),
);

// Storage usage + quota for the media-library header / quota meter.
mediaRouter.get(
  '/usage',
  asyncHandler(async (req, res) => {
    res.json(await service.getStorageOverview(req.user!.id));
  }),
);

const recordBody = z.object({
  publicId: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  resourceType: z.enum(['image', 'video', 'raw']).optional(),
  kind: z.string().max(40).optional(),
  folder: z.string().max(120).optional(),
  filename: z.string().max(300).optional(),
  bytes: z.number().int().min(0).optional(),
  format: z.string().max(20).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
});

mediaRouter.post(
  '/',
  validate({ body: recordBody }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ media: await service.recordMedia(req.user!.id, req.body) });
  }),
);

// Folders -------------------------------------------------------------
mediaRouter.get(
  '/folders',
  asyncHandler(async (req, res) => {
    res.json(await service.listFolders(req.user!.id));
  }),
);

mediaRouter.post(
  '/folders',
  validate({ body: z.object({ name: z.string().min(1).max(120) }) }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ folder: await service.createFolder(req.user!.id, req.body.name) });
  }),
);

mediaRouter.patch(
  '/folders/:id',
  validate({
    params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }),
    body: z.object({ name: z.string().min(1).max(120) }),
  }),
  asyncHandler(async (req, res) => {
    res.json({ folder: await service.renameFolder(req.user!.id, String(req.params.id), req.body.name) });
  }),
);

mediaRouter.delete(
  '/folders/:id',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    await service.deleteFolder(req.user!.id, String(req.params.id));
    res.status(204).end();
  }),
);

// Signed delivery URL for previewing/downloading one asset (raw docs are gated
// by Cloudinary's PDF/ZIP delivery restriction, so they need a signed URL).
mediaRouter.get(
  '/:id/file-url',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    res.json(await service.getMediaFileUrl(req.user!.id, String(req.params.id)));
  }),
);

// Media item: rename and/or move to a folder ('' = root).
mediaRouter.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }),
    body: z.object({
      filename: z.string().min(1).max(300).optional(),
      folder: z.string().max(120).optional(),
    }).refine((b) => b.filename !== undefined || b.folder !== undefined, 'Nothing to update'),
  }),
  asyncHandler(async (req, res) => {
    res.json({ media: await service.updateMedia(req.user!.id, String(req.params.id), req.body) });
  }),
);

mediaRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    await service.deleteMedia(req.user!.id, String(req.params.id));
    res.status(204).end();
  }),
);
