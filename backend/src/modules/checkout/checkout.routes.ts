import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import {
  createCheckoutSession,
  createCourseCheckoutSession,
  claimFreeProduct,
  previewCheckoutPricing,
  createPayPalProductCheckout,
  createPayPalCourseCheckout,
  capturePayPalOrder,
  getPaymentMethods,
} from './checkout.service';

export const checkoutRouter = Router();

const sessionSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().max(120).optional(),
  source: z.string().max(60).optional(),
  campaign: z.record(z.string(), z.unknown()).optional(),
  discountCode: z.string().max(40).optional(),
  orderBump: z.boolean().optional(),
  affiliateRef: z.string().max(60).optional(),
  customFieldValues: z.record(z.string(), z.string().max(500)).optional(),
});

const claimSchema = sessionSchema.extend({
  email: z.string().email(),
});

const previewSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  discountCode: z.string().max(40).optional(),
  orderBump: z.boolean().optional(),
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
  '/claim',
  publicWriteLimiter,
  validate({ body: claimSchema }),
  asyncHandler(async (req, res) => {
    const result = await claimFreeProduct(req.body);
    res.json(result);
  }),
);

checkoutRouter.get(
  '/payment-methods/:username',
  asyncHandler(async (req, res) => {
    res.json(await getPaymentMethods(String(req.params.username)));
  }),
);

checkoutRouter.post(
  '/preview',
  publicWriteLimiter,
  validate({ body: previewSchema }),
  asyncHandler(async (req, res) => {
    const result = await previewCheckoutPricing(req.body);
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

/* ---- PayPal ---- */

checkoutRouter.post(
  '/paypal/session',
  publicWriteLimiter,
  validate({ body: sessionSchema }),
  asyncHandler(async (req, res) => {
    res.json(await createPayPalProductCheckout(req.body));
  }),
);

checkoutRouter.post(
  '/paypal/course-session',
  publicWriteLimiter,
  validate({ body: sessionSchema }),
  asyncHandler(async (req, res) => {
    res.json(await createPayPalCourseCheckout(req.body));
  }),
);

checkoutRouter.post(
  '/paypal/capture',
  publicWriteLimiter,
  validate({ body: z.object({ orderId: z.string().min(1).max(64) }) }),
  asyncHandler(async (req, res) => {
    res.json(await capturePayPalOrder(req.body.orderId));
  }),
);
