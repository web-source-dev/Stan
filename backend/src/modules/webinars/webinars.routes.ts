import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './webinars.service';

const id = z.string().regex(/^[a-f0-9]{24}$/);
const idParam = z.object({ id });

export const webinarsRouter = Router();
webinarsRouter.use(requireAuth);

const slotSchema = z.object({
  startsAt: z.string().min(1),
});

const emailFlowStepSchema = z.object({
  dayOffset: z.number().int().min(0).max(365),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(5000),
  enabled: z.boolean().default(true),
});

const customFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'textarea', 'phone']).default('text'),
  required: z.boolean().default(false),
});

const webinarBody = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  shortDescription: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().min(0).max(100_000_00).optional(),
  coverImageUrl: z.string().max(2000).optional(),
  coverPublicId: z.string().max(300).optional(),
  discountPriceCents: z.number().int().min(0).optional(),
  discountEnabled: z.boolean().optional(),
  thumbnailStyle: z.enum(['button', 'callout', 'preview']).optional(),
  thumbnailButtonLabel: z.string().max(80).optional(),
  bottomTitle: z.string().max(140).optional(),
  ctaLabel: z.string().max(80).optional(),
  slots: z.array(slotSchema).max(100).optional(),
  durationMin: z.number().int().min(15).max(240).optional(),
  timezone: z.string().max(80).optional(),
  calendarIntegration: z.string().max(80).optional(),
  capacityPerSlot: z.number().int().min(1).max(10_000).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderHoursBefore: z.number().int().min(1).max(168).optional(),
  emailFlows: z.array(emailFlowStepSchema).max(20).optional(),
  customFields: z.array(customFieldSchema).max(15).optional(),
  confirmSubject: z.string().max(200).optional(),
  confirmBody: z.string().max(5000).optional(),
});

webinarsRouter.get('/', asyncHandler(async (req, res) => res.json({ webinars: await service.listWebinars(req.user!.id) })));
webinarsRouter.post('/', validate({ body: webinarBody }), asyncHandler(async (req, res) => res.status(201).json({ webinar: await service.createWebinar(req.user!.id, req.body) })));
webinarsRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ webinar: await service.getWebinar(req.user!.id, String(req.params.id)) })));
webinarsRouter.patch('/:id', validate({ params: idParam, body: webinarBody.partial() }), asyncHandler(async (req, res) => res.json({ webinar: await service.updateWebinar(req.user!.id, String(req.params.id), req.body) })));
webinarsRouter.post('/:id/publish', validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ webinar: await service.publishWebinar(req.user!.id, String(req.params.id)) })));
webinarsRouter.post('/:id/status', validate({ params: idParam, body: z.object({ status: z.enum(['draft', 'archived']) }) }), asyncHandler(async (req, res) => res.json({ webinar: await service.setWebinarStatus(req.user!.id, String(req.params.id), req.body.status) })));
