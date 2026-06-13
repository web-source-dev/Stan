import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { globalLimiter } from '../../middleware/rateLimit';
import * as service from './analytics.service';

// Public event ingest (mounted at /api/events).
export const analyticsRouter = Router();

const trackSchema = z.object({
  username: z.string().min(1),
  type: z.enum(['view', 'cta_click', 'product_click', 'checkout_start', 'lead_submit']),
  slug: z.string().max(80).optional(),
  anonId: z.string().max(64).optional(),
  path: z.string().max(300).optional(),
});

analyticsRouter.post(
  '/',
  globalLimiter,
  validate({ body: trackSchema }),
  asyncHandler(async (req, res) => {
    // Fire-and-forget from the client's perspective; never error the beacon.
    await service.track(req.body).catch(() => {});
    res.status(204).end();
  }),
);

// Authenticated creator conversion summary.
const creatorAnalytics = Router();
creatorAnalytics.use(requireAuth);
creatorAnalytics.get(
  '/summary',
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).optional() }) }),
  asyncHandler(async (req, res) => {
    res.json(await service.summary(req.user!.id, req.query.days ? Number(req.query.days) : undefined));
  }),
);

analyticsRouter.use('/insights', creatorAnalytics);
