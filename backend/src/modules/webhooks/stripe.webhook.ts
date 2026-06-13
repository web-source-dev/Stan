import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { stripe } from '../../lib/stripe';
import { WebhookEventModel } from '../../models/WebhookEvent';
import { fulfilCheckoutSession, markRefunded } from '../checkout/fulfilment.service';
import { syncFromWebhook } from '../payments/connect.service';

/**
 * Stripe webhook receiver. Mounted before the JSON parser with a raw body so
 * the signature can be verified. Responds 2xx fast after recording the event;
 * heavy work (fulfilment) is quick here but enqueues durable email jobs.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: { code: 'stripe_unconfigured', message: 'Webhooks not configured' } });
    return;
  }

  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: { code: 'invalid_signature', message: 'Signature verification failed' } });
    return;
  }

  // Idempotency: record the event; a duplicate delivery short-circuits.
  try {
    await WebhookEventModel.create({
      provider: 'stripe',
      eventId: event.id,
      type: event.type,
      status: 'received',
    });
  } catch {
    // Duplicate (provider, eventId) — already seen. Ack and stop.
    res.json({ received: true, duplicate: true });
    return;
  }

  // Acknowledge fast, then process. (Processing here is lightweight and itself
  // enqueues durable jobs for anything slow, e.g. email.)
  res.json({ received: true });

  try {
    await processEvent(event);
    await WebhookEventModel.updateOne(
      { provider: 'stripe', eventId: event.id },
      { $set: { status: 'processed', processedAt: new Date() }, $inc: { attempts: 1 } },
    );
  } catch (err) {
    logger.error({ err, type: event.type, id: event.id }, 'Stripe webhook processing failed');
    await WebhookEventModel.updateOne(
      { provider: 'stripe', eventId: event.id },
      { $set: { status: 'failed', lastError: err instanceof Error ? err.message : String(err) }, $inc: { attempts: 1 } },
    );
  }
}

export async function processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfilCheckoutSession(session, event.account);
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === 'string') await markRefunded(charge.payment_intent);
      break;
    }
    case 'account.updated': {
      await syncFromWebhook(event.data.object as Stripe.Account);
      break;
    }
    default:
      logger.debug({ type: event.type }, 'Unhandled Stripe event type');
  }
}
