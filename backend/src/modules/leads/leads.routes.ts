import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import * as service from './leads.service';

// Public lead capture (mounted at /api/leads).
export const leadsRouter = Router();

const captureSchema = z.object({
  username: z.string().min(1),
  email: z.string().email().toLowerCase(),
  firstName: z.string().max(80).optional(),
  source: z.enum(['storefront', 'product', 'checkout', 'other']).optional(),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(100).optional(),
    })
    .optional(),
  consent: z.boolean().optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
});

leadsRouter.post(
  '/',
  publicWriteLimiter,
  validate({ body: captureSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.captureLead(req.body);
    res.status(201).json(result);
  }),
);

// Authenticated creator views.
const creatorLeads = Router();
creatorLeads.use(requireAuth);
creatorLeads.get(
  '/',
  asyncHandler(async (req, res) => {
    const leads = await service.listLeads(req.user!.id, { customersOnly: req.query.customers === '1' });
    res.json({ leads });
  }),
);
creatorLeads.get(
  '/stats',
  asyncHandler(async (req, res) => {
    res.json(await service.leadStats(req.user!.id));
  }),
);

const contactSchema = z.object({
  email: z.string().email().toLowerCase(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(32).optional(),
});

creatorLeads.post(
  '/',
  validate({ body: contactSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.createContact(req.user!.id, req.body);
    res.status(result.created ? 201 : 200).json(result);
  }),
);

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().max(160),
        firstName: z.string().max(80).optional(),
        lastName: z.string().max(80).optional(),
        phone: z.string().max(32).optional(),
      }),
    )
    .max(5000),
});

creatorLeads.post(
  '/import',
  validate({ body: importSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.importContacts(req.user!.id, req.body.rows);
    res.status(201).json(result);
  }),
);

leadsRouter.use('/manage', creatorLeads);
