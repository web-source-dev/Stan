import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { verifyWebhookSignature } from '../../lib/paypal';
import { WebhookEventModel } from '../../models/WebhookEvent';
import { capturePayPalOrder } from '../checkout/checkout.service';
import { markRefunded } from '../checkout/fulfilment.service';

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    supplementary_data?: { related_ids?: { capture_id?: string; order_id?: string } };
    links?: { href: string; rel: string }[];
  };
}

/** Pull the related capture id from a refund/reversal resource. */
function captureIdFromRefund(resource: PayPalWebhookEvent['resource']): string | undefined {
  const fromData = resource?.supplementary_data?.related_ids?.capture_id;
  if (fromData) return fromData;
  // Fallback: the "up" link points at /v2/payments/captures/<id>.
  const up = resource?.links?.find((l) => l.rel === 'up')?.href;
  return up?.split('/captures/')[1];
}

/**
 * PayPal webhook receiver (mounted with a raw body so the signature can be
 * verified). It's a RELIABILITY backstop — the normal flow captures on the
 * return page. Handles:
 *  - CHECKOUT.ORDER.APPROVED → capture + fulfil if the buyer never returned.
 *  - PAYMENT.CAPTURE.REFUNDED / .REVERSED → revoke access (mark order refunded).
 */
export async function handlePayPalWebhook(req: Request, res: Response): Promise<void> {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: { code: 'bad_payload', message: 'Invalid JSON' } });
    return;
  }

  // Verify when a webhook id is configured. In production we REQUIRE a verified
  // signature; in dev without a webhook id we accept (so the flow is testable).
  const verified = await verifyWebhookSignature(req.headers as Record<string, string | undefined>, raw).catch(() => false);
  if (!verified) {
    if (env.isProd || env.PAYPAL_WEBHOOK_ID) {
      logger.warn({ eventType: event.event_type }, 'Rejected unverified PayPal webhook');
      res.status(400).json({ error: { code: 'invalid_signature', message: 'Signature verification failed' } });
      return;
    }
  }

  // Idempotency: record (provider,eventId); a duplicate short-circuits.
  if (event.id) {
    try {
      await WebhookEventModel.create({ provider: 'paypal', eventId: event.id, type: event.event_type, status: 'received' });
    } catch {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
  }

  // Ack fast; provider retries on non-2xx.
  res.status(200).json({ received: true });

  try {
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' && event.resource?.id) {
      // Capture is idempotent: a completed intent returns without re-capturing.
      await capturePayPalOrder(event.resource.id).catch((e) => logger.warn({ e }, 'PayPal approve-capture fallback failed'));
    } else if (
      event.event_type === 'PAYMENT.CAPTURE.REFUNDED' ||
      event.event_type === 'PAYMENT.CAPTURE.REVERSED'
    ) {
      const capId = captureIdFromRefund(event.resource);
      if (capId) await markRefunded(capId);
    }
    if (event.id) {
      await WebhookEventModel.updateOne({ provider: 'paypal', eventId: event.id }, { $set: { status: 'processed', processedAt: new Date() } });
    }
  } catch (err) {
    logger.error({ err, eventType: event.event_type }, 'PayPal webhook processing error');
    if (event.id) {
      await WebhookEventModel.updateOne({ provider: 'paypal', eventId: event.id }, { $set: { status: 'failed', lastError: String(err) } }).catch(() => {});
    }
  }
}
