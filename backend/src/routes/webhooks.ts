import { Router, raw } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { handleStripeWebhook } from '../modules/webhooks/stripe.webhook';

/**
 * Webhook endpoints are mounted before the JSON parser because signature
 * verification requires the raw request body. Resend webhooks land in the
 * email phase; Stripe is live as of the commerce phase.
 */
export const webhookRouter = Router();

webhookRouter.post('/stripe', raw({ type: 'application/json' }), asyncHandler(handleStripeWebhook));

webhookRouter.post('/resend', raw({ type: 'application/json' }), (_req, res) => {
  res.status(501).json({ error: { code: 'not_implemented', message: 'Resend webhooks land in the email phase' } });
});
