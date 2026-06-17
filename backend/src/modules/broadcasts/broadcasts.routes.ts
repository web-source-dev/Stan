import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import * as service from './broadcasts.service';
import type { Segment } from '../../models/Broadcast';

// Mounted at /api/broadcasts.
export const broadcastsRouter = Router();

const segment = z.enum(['all_leads', 'customers', 'subscribers']);

// Public unsubscribe (no auth — link from emails).
const unsubSchema = z.object({
  creatorId: z.string().regex(/^[a-f0-9]{24}$/),
  email: z.string().email(),
  token: z.string().min(1).max(64),
});
broadcastsRouter.post(
  '/unsubscribe',
  publicWriteLimiter,
  validate({ body: unsubSchema }),
  asyncHandler(async (req, res) => {
    await service.unsubscribe(req.body.creatorId, req.body.email, req.body.token);
    res.json({ ok: true });
  }),
);

// Authenticated creator routes.
const creator = Router();
creator.use(requireAuth);

creator.get('/', asyncHandler(async (req, res) => res.json({ broadcasts: await service.listBroadcasts(req.user!.id) })));

creator.get(
  '/preview',
  validate({ query: z.object({ segment }) }),
  asyncHandler(async (req, res) => {
    res.json(await service.previewSegment(req.user!.id, req.query.segment as Segment));
  }),
);

const sendSchema = z.object({
  subject: z.string().min(1).max(200),
  bodyText: z.string().min(1).max(20000),
  bodyHtml: z.string().max(50000).optional(),
  segment,
});
creator.post(
  '/send',
  requireVerifiedEmail,
  validate({ body: sendSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.sendBroadcast(req.user!.id, req.body);
    res.status(201).json({ broadcast: result });
  }),
);

broadcastsRouter.use('/manage', creator);
