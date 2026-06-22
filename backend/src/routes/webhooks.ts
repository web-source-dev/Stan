import { Router, raw } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { handleStripeWebhook } from '../modules/webhooks/stripe.webhook';
import { handlePayPalWebhook } from '../modules/webhooks/paypal.webhook';
import { verifyInstagramWebhook, handleInstagramWebhook } from '../modules/webhooks/instagram.webhook';

/**
 * Webhook endpoints are mounted before the JSON parser because signature
 * verification requires the raw request body. Resend webhooks land in the
 * email phase; Stripe is live as of the commerce phase.
 */
export const webhookRouter = Router();

webhookRouter.post('/stripe', raw({ type: 'application/json' }), asyncHandler(handleStripeWebhook));

webhookRouter.post('/paypal', raw({ type: 'application/json' }), asyncHandler(handlePayPalWebhook));

webhookRouter.post('/resend', raw({ type: 'application/json' }), (_req, res) => {
  res.status(501).json({ error: { code: 'not_implemented', message: 'Resend webhooks land in the email phase' } });
});

// Instagram: GET handshake (subscription verification), POST event receiver
// (raw body so the X-Hub-Signature-256 HMAC can be verified).
webhookRouter.get('/instagram', verifyInstagramWebhook);
webhookRouter.post('/instagram', raw({ type: 'application/json' }), asyncHandler(handleInstagramWebhook));
