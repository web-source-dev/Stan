import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import {
  cancelRegistrationByToken,
  createWebinarRegistration,
  getRegistrationByToken,
  getWebinarAvailability,
} from './webinars.service';

/** Public webinar registration (mounted at /api/webinar-registrations). */
export const webinarRegistrationsRouter = Router();

webinarRegistrationsRouter.get(
  '/availability',
  validate({ query: z.object({ username: z.string().min(1), slug: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as { username: string; slug: string };
    res.json(await getWebinarAvailability(q.username, q.slug));
  }),
);

webinarRegistrationsRouter.post(
  '/',
  publicWriteLimiter,
  validate({
    body: z.object({
      username: z.string().min(1),
      slug: z.string().min(1),
      slotId: z.string().regex(/^[a-f0-9]{24}$/),
      email: z.string().email(),
      name: z.string().max(120).optional(),
      customFieldValues: z.record(z.string(), z.string().max(500)).optional(),
      provider: z.enum(['stripe', 'paypal']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createWebinarRegistration(req.body));
  }),
);

const tokenParam = z.object({ token: z.string().min(20).max(200) });

webinarRegistrationsRouter.get(
  '/manage/:token',
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    res.json({ registration: await getRegistrationByToken(String(req.params.token)) });
  }),
);

webinarRegistrationsRouter.post(
  '/manage/:token/cancel',
  publicWriteLimiter,
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    res.json(await cancelRegistrationByToken(String(req.params.token)));
  }),
);
