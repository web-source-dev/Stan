import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  incomeSummary,
  listCreatorOrders,
  revenueTimeseries,
  createPayoutDashboardLink,
  getCreatorOrder,
  fulfillCustomOrder,
} from './orders.service';

// Authenticated creator order views (mounted at /api/orders).
export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const orderIdParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

const fulfillmentAssetSchema = z.object({
  publicId: z.string().min(1).max(500),
  resourceType: z.enum(['raw', 'image', 'video']).default('raw'),
  filename: z.string().min(1).max(500),
  bytes: z.number().min(0).default(0),
  format: z.string().max(50).default(''),
});

const fulfillBodySchema = z
  .object({
    message: z.string().max(5000).optional().default(''),
    deliveryUrl: z.string().url().max(2000).optional().or(z.literal('')).default(''),
    assets: z.array(fulfillmentAssetSchema).max(20).default([]),
  })
  .refine((d) => d.message.trim() || d.deliveryUrl.trim() || d.assets.length > 0, {
    message: 'Provide a message, delivery link, or at least one file.',
  });

ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ orders: await listCreatorOrders(req.user!.id) });
  }),
);

ordersRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await incomeSummary(req.user!.id));
  }),
);

ordersRouter.get(
  '/timeseries',
  asyncHandler(async (req, res) => {
    res.json({ series: await revenueTimeseries(req.user!.id) });
  }),
);

/** Stripe Express dashboard login link for cashing out to bank. */
ordersRouter.post(
  '/payouts/login',
  asyncHandler(async (req, res) => {
    res.json(await createPayoutDashboardLink(req.user!.id));
  }),
);

ordersRouter.get(
  '/:id',
  validate({ params: orderIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ order: await getCreatorOrder(req.user!.id, String(req.params.id)) });
  }),
);

ordersRouter.post(
  '/:id/fulfill',
  validate({ params: orderIdParam, body: fulfillBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof fulfillBodySchema>;
    res.json(await fulfillCustomOrder(req.user!.id, String(req.params.id), body));
  }),
);
