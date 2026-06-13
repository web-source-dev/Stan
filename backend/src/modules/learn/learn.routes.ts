import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { signedDeliveryUrl } from '../../lib/cloudinary';
import * as service from './learn.service';

// Public course player + enrollment (mounted at /api/learn). Buyers use an
// opaque access token, not an authenticated account.
export const learnRouter = Router();

const tokenParam = z.object({ token: z.string().min(20).max(200) });
const objectId = z.string().regex(/^[a-f0-9]{24}$/);

learnRouter.post(
  '/enroll',
  publicWriteLimiter,
  validate({ body: z.object({ username: z.string().min(1), slug: z.string().min(1), email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.enrollFree(req.body.username, req.body.slug, req.body.email));
  }),
);

learnRouter.get(
  '/:token',
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => res.json(await service.getPlayer(String(req.params.token)))),
);

learnRouter.post(
  '/:token/progress',
  validate({ params: tokenParam, body: z.object({ lessonId: objectId, complete: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    res.json(await service.setLessonComplete(String(req.params.token), req.body.lessonId, req.body.complete));
  }),
);

// Mint a short-lived signed URL for a lesson's video/asset, then redirect.
learnRouter.get(
  '/:token/lesson/:lessonId/media',
  publicWriteLimiter,
  validate({ params: tokenParam.extend({ lessonId: objectId }) }),
  asyncHandler(async (req, res) => {
    if (!env.cloudinaryConfigured) throw new AppError(503, 'cloudinary_unconfigured', 'Media not configured');
    const { publicId, resourceType } = await service.getLessonAsset(String(req.params.token), String(req.params.lessonId));
    res.redirect(302, signedDeliveryUrl(publicId, resourceType, 600));
  }),
);
