import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireFeature } from '../subscription/subscription.guard';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import * as service from './bookings.service';

const id = z.string().regex(/^[a-f0-9]{24}$/);
const idParam = z.object({ id });

const weeklyWindow = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

const typeBody = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),
  bottomTitle: z.string().max(140).optional(),
  ctaLabel: z.string().max(80).optional(),
  coverImageUrl: z.string().max(2000).optional(),
  coverPublicId: z.string().max(200).optional(),
  thumbnailStyle: z.enum(['button', 'callout', 'preview']).optional(),
  thumbnailButtonLabel: z.string().max(80).optional(),
  discountPriceCents: z.number().int().min(0).optional(),
  discountEnabled: z.boolean().optional(),
  durationMin: z.number().int().min(5).max(600).optional(),
  priceCents: z.number().int().min(0).max(100_000_00).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(64).optional(),
  weeklyWindows: z.array(weeklyWindow).max(50).optional(),
  minNoticeMin: z.number().int().min(0).optional(),
  maxHorizonDays: z.number().int().min(1).max(365).optional(),
  bufferBeforeMin: z.number().int().min(0).optional(),
  bufferAfterMin: z.number().int().min(0).optional(),
  bufferBeforeEnabled: z.boolean().optional(),
  bufferAfterEnabled: z.boolean().optional(),
  dailyCap: z.number().int().min(0).optional(),
  maxAttendees: z.number().int().min(1).max(100).optional(),
  calendarLabel: z.string().max(80).optional(),
  meetingProvider: z.enum(['manual', 'google', 'zoom']).optional(),
  meetingUrl: z.string().url().max(1000).optional().or(z.literal('')),
  intakeQuestions: z.array(z.string().max(200)).max(10).optional(),
  confirmSubject: z.string().max(200).optional(),
  confirmBody: z.string().max(5000).optional(),
});

// ---- Creator routes (mounted at /api/booking-types) ----
export const bookingTypesRouter = Router();
bookingTypesRouter.use(requireAuth);
bookingTypesRouter.use(requireFeature('bookings'));

bookingTypesRouter.get('/', asyncHandler(async (req, res) => res.json({ bookingTypes: await service.listBookingTypes(req.user!.id) })));
bookingTypesRouter.get('/bookings', asyncHandler(async (req, res) => res.json({ bookings: await service.listBookings(req.user!.id) })));

// Blocked time (creator-wide calendar holds). Registered before `/:id` so the
// literal `/blocks` path isn't swallowed by the id route.
const blockBody = z.object({
  startIso: z.string().min(10),
  endIso: z.string().min(10),
  allDay: z.boolean().optional(),
  note: z.string().max(200).optional(),
});
bookingTypesRouter.get('/blocks', validate({ query: z.object({ from: z.string().optional(), to: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const q = req.query as { from?: string; to?: string };
  res.json({ blocks: await service.listBlocks(req.user!.id, q.from, q.to) });
}));
bookingTypesRouter.post('/blocks', validate({ body: blockBody }), asyncHandler(async (req, res) => res.status(201).json({ block: await service.createBlock(req.user!.id, req.body) })));
bookingTypesRouter.delete('/blocks/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.deleteBlock(req.user!.id, String(req.params.id));
  res.json({ ok: true });
}));

bookingTypesRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ bookingType: await service.getBookingType(req.user!.id, String(req.params.id)) })));
bookingTypesRouter.post('/', validate({ body: typeBody }), asyncHandler(async (req, res) => res.status(201).json({ bookingType: await service.createBookingType(req.user!.id, req.body) })));
bookingTypesRouter.patch('/:id', validate({ params: idParam, body: typeBody.partial() }), asyncHandler(async (req, res) => res.json({ bookingType: await service.updateBookingType(req.user!.id, String(req.params.id), req.body) })));
bookingTypesRouter.post('/:id/publish', validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ bookingType: await service.publishBookingType(req.user!.id, String(req.params.id)) })));
bookingTypesRouter.post('/:id/status', validate({ params: idParam, body: z.object({ status: z.enum(['draft', 'archived']) }) }), asyncHandler(async (req, res) => res.json({ bookingType: await service.setBookingTypeStatus(req.user!.id, String(req.params.id), req.body.status) })));

// ---- Public routes (mounted at /api/bookings) ----
export const bookingsRouter = Router();

bookingsRouter.get(
  '/availability',
  validate({ query: z.object({ username: z.string().min(1), slug: z.string().min(1), from: z.string().optional(), to: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as { username: string; slug: string; from?: string; to?: string };
    res.json(await service.getAvailability(q.username, q.slug, q.from, q.to));
  }),
);

bookingsRouter.post(
  '/',
  publicWriteLimiter,
  validate({
    body: z.object({
      username: z.string().min(1),
      slug: z.string().min(1),
      email: z.string().email(),
      name: z.string().max(120).optional(),
      startIso: z.string().min(10),
      intakeAnswers: z.array(z.object({ question: z.string().max(200), answer: z.string().max(2000) })).max(10).optional(),
      provider: z.enum(['stripe', 'paypal']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createBooking(req.body));
  }),
);

const tokenParam = z.object({ token: z.string().min(20).max(200) });
bookingsRouter.get('/manage/:token', validate({ params: tokenParam }), asyncHandler(async (req, res) => res.json({ booking: await service.getBookingByToken(String(req.params.token)) })));
bookingsRouter.post('/manage/:token/cancel', publicWriteLimiter, validate({ params: tokenParam }), asyncHandler(async (req, res) => {
  await service.cancelBooking(String(req.params.token));
  res.json({ ok: true });
}));
