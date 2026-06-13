import Stripe from 'stripe';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

/**
 * Single Stripe client. Null when STRIPE_SECRET_KEY is unset so the rest of the
 * app can degrade gracefully in local/dev without keys.
 */
// apiVersion is intentionally omitted so it tracks the SDK's bundled pinned
// version, avoiding literal-type mismatches across Stripe SDK upgrades.
export const stripe: Stripe | null = env.stripeConfigured
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

/** Throw a clean 503 if a Stripe-dependent path is hit while unconfigured. */
export function requireStripe(): Stripe {
  if (!stripe) throw new AppError(503, 'stripe_unconfigured', 'Payments are not configured');
  return stripe;
}

/** Platform application-fee rate applied to connected-account charges. */
export const APPLICATION_FEE_BPS = 500; // 5.00%

export function applicationFee(amountCents: number): number {
  return Math.round((amountCents * APPLICATION_FEE_BPS) / 10_000);
}
