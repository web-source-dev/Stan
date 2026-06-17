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
});

mediaRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as z.infer<typeof listQuery>;
    res.json(await service.listMedia(req.user!.id, q));
  }),
);

const recordBody = z.object({
  publicId: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  resourceType: z.enum(['image', 'video', 'raw']).optional(),
  kind: z.string().max(40).optional(),
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

mediaRouter.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }),
    body: z.object({ filename: z.string().min(1).max(300) }),
  }),
  asyncHandler(async (req, res) => {
    res.json({ media: await service.renameMedia(req.user!.id, String(req.params.id), req.body.filename) });
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
