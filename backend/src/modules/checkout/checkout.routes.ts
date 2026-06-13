import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import { createCheckoutSession, createCourseCheckoutSession } from './checkout.service';

// Public checkout (mounted at /api/checkout). Buyers are not authenticated.
export const checkoutRouter = Router();

const sessionSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email().optional(),
  source: z.string().max(60).optional(),
  campaign: z.record(z.string(), z.unknown()).optional(),
});

checkoutRouter.post(
  '/session',
  publicWriteLimiter,
  validate({ body: sessionSchema }),
  asyncHandler(async (req, res) => {
    const result = await createCheckoutSession(req.body);
    res.json(result);
  }),
);

checkoutRouter.post(
  '/course-session',
  publicWriteLimiter,
  validate({ body: sessionSchema }),
  asyncHandler(async (req, res) => {
    const result = await createCourseCheckoutSession(req.body);
    res.json(result);
  }),
);
