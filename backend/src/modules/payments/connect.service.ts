import type Stripe from 'stripe';
import { env } from '../../config/env';
import { requireStripe } from '../../lib/stripe';
import { AppError } from '../../utils/AppError';
import { PaymentAccountModel, type PaymentAccountDoc } from '../../models/PaymentAccount';
import { UserModel } from '../../models/User';
import { recordAudit } from '../../lib/audit';

/** Seed/demo account ids are not real Stripe Connect accounts. */
const PLACEHOLDER_STRIPE_ACCOUNT = /^acct_(seed_|demo)/;

/** Use the browser origin when allowed (fixes localhost:3000 vs :3001 mismatches). */
export function resolveAppUrl(candidate?: string): string {
  const fallback = env.APP_URL.replace(/\/+$/, '');
  if (!candidate?.trim()) return fallback;
  try {
    const origin = new URL(candidate.trim()).origin;
    const allowed = env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (
      allowed.some((o) => {
        try {
          return new URL(o).origin === origin;
        } catch {
          return false;
        }
      })
    ) {
      return origin;
    }
  } catch {
    /* ignore malformed candidate */
  }
  return fallback;
}

export function isPlaceholderStripeAccountId(id?: string | null): boolean {
  return Boolean(id && PLACEHOLDER_STRIPE_ACCOUNT.test(id));
}

/** Remove fake Connect ids left by seed data when real Stripe keys are in use. */
export async function clearPlaceholderStripeAccounts(): Promise<void> {
  if (!env.stripeConfigured) return;
  await PaymentAccountModel.updateMany(
    { stripeAccountId: { $regex: /^acct_(seed_|demo)/ } },
    {
      $unset: { stripeAccountId: '' },
      $set: {
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingStatus: 'not_started',
        requirementsDue: [],
      },
    },
  );
}

function publicStatus(acc: PaymentAccountDoc | null) {
  const connected = Boolean(acc?.stripeAccountId && !isPlaceholderStripeAccountId(acc.stripeAccountId));
  return {
    connected,
    chargesEnabled: connected && (acc?.chargesEnabled ?? false),
    payoutsEnabled: connected && (acc?.payoutsEnabled ?? false),
    detailsSubmitted: connected && (acc?.detailsSubmitted ?? false),
    onboardingStatus: connected ? (acc?.onboardingStatus ?? 'not_started') : 'not_started',
    requirementsDue: connected ? (acc?.requirementsDue ?? []) : [],
    stripeConfigured: env.stripeConfigured,
    demoCheckout: env.demoCheckout,
  };
}

function applyAccountState(acc: PaymentAccountDoc, account: Stripe.Account) {
  acc.chargesEnabled = account.charges_enabled;
  acc.payoutsEnabled = account.payouts_enabled;
  acc.detailsSubmitted = account.details_submitted;
  acc.requirementsDue = account.requirements?.currently_due ?? [];
  if (account.charges_enabled && account.details_submitted) acc.onboardingStatus = 'complete';
  else if (account.details_submitted) acc.onboardingStatus = 'restricted';
  else acc.onboardingStatus = 'pending';
}

/** Get or create the creator's Connect account row + Stripe account. */
export async function ensureAccount(creatorId: string): Promise<PaymentAccountDoc> {
  const stripe = requireStripe();
  let acc = await PaymentAccountModel.findOne({ creatorId });
  if (acc?.stripeAccountId && !isPlaceholderStripeAccountId(acc.stripeAccountId)) return acc;

  const user = await UserModel.findById(creatorId);
  const account = await stripe.accounts.create({
    type: 'express',
    email: user?.email,
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_profile: { product_description: 'Digital products and services sold via CreatorStore' },
    metadata: { creatorId },
  });

  if (!acc) acc = new PaymentAccountModel({ creatorId });
  acc.stripeAccountId = account.id;
  acc.onboardingStatus = 'pending';
  await acc.save();
  recordAudit({ action: 'payments.connect_created', actorId: creatorId, actorType: 'user', creatorId });
  return acc;
}

/** Create a one-time onboarding link to Stripe-hosted Express onboarding. */
export async function createOnboardingLink(creatorId: string, returnBase?: string): Promise<{ url: string }> {
  const stripe = requireStripe();
  const acc = await ensureAccount(creatorId);
  const appUrl = resolveAppUrl(returnBase);
  const settingsPayments = `${appUrl}/dashboard/settings?tab=payments`;
  const link = await stripe.accountLinks.create({
    account: acc.stripeAccountId!,
    refresh_url: `${settingsPayments}&connect=refresh`,
    return_url: `${settingsPayments}&connect=return`,
    type: 'account_onboarding',
  });
  return { url: link.url };
}

/** Pull live account state from Stripe and persist the mirror. */
export async function refreshStatus(creatorId: string) {
  const stripe = requireStripe();
  const acc = await PaymentAccountModel.findOne({ creatorId });
  if (!acc?.stripeAccountId) return publicStatus(acc);
  const account = await stripe.accounts.retrieve(acc.stripeAccountId);
  applyAccountState(acc, account);
  await acc.save();
  return publicStatus(acc);
}

export async function getStatus(creatorId: string) {
  const acc = await PaymentAccountModel.findOne({ creatorId });
  return publicStatus(acc);
}

/** Apply an account.updated webhook to the mirror. */
export async function syncFromWebhook(account: Stripe.Account): Promise<void> {
  const acc = await PaymentAccountModel.findOne({ stripeAccountId: account.id });
  if (!acc) return;
  applyAccountState(acc, account);
  await acc.save();
}

/** True when the creator can accept card payments via Stripe Connect. */
export async function canAcceptPayments(creatorId: string): Promise<boolean> {
  if (env.demoCheckout) return true;
  if (!env.stripeConfigured) return false;

  const acc = await PaymentAccountModel.findOne({ creatorId });
  if (!acc?.stripeAccountId || isPlaceholderStripeAccountId(acc.stripeAccountId)) return false;

  if (!acc.chargesEnabled) {
    await refreshStatus(creatorId).catch(() => {});
    const refreshed = await PaymentAccountModel.findOne({ creatorId });
    return Boolean(refreshed?.chargesEnabled && !isPlaceholderStripeAccountId(refreshed.stripeAccountId));
  }
  return true;
}

export async function getConnectedAccountId(creatorId: string): Promise<string | null> {
  const acc = await PaymentAccountModel.findOne({ creatorId });
  if (!acc?.stripeAccountId || isPlaceholderStripeAccountId(acc.stripeAccountId)) return null;
  return acc.stripeAccountId;
}

/* ------------------------------------------------------------------ */
/* PayPal                                                              */
/* ------------------------------------------------------------------ */

/** The creator's connected PayPal payee email (empty when not connected). */
export async function getPayPalPayee(creatorId: string): Promise<string> {
  const acc = await PaymentAccountModel.findOne({ creatorId });
  return acc?.paypalEmail ?? '';
}

/**
 * Whether the creator can accept PayPal. In demo mode (no platform creds, non
 * prod) PayPal is always available so the flow is demonstrable. Live mode needs
 * platform credentials AND the creator to have connected a payee email.
 */
export async function canAcceptPayPal(creatorId: string): Promise<boolean> {
  if (env.paypalDemo) return true;
  if (!env.paypalConfigured) return false;
  return Boolean(await getPayPalPayee(creatorId));
}

/** Save / clear the creator's PayPal payee email. */
export async function setPayPalEmail(creatorId: string, email: string) {
  const acc = (await PaymentAccountModel.findOne({ creatorId })) ?? new PaymentAccountModel({ creatorId });
  const clean = email.trim().toLowerCase();
  if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new AppError(400, 'invalid_email', 'Enter a valid PayPal email address');
  }
  acc.paypalEmail = clean;
  acc.paypalConnectedAt = clean ? new Date() : undefined;
  await acc.save();
  recordAudit({ action: clean ? 'payments.paypal_connected' : 'payments.paypal_disconnected', actorId: creatorId, actorType: 'user', creatorId });
  return { paypalEmail: acc.paypalEmail };
}

/** PayPal connection status for the dashboard. */
export async function getPayPalStatus(creatorId: string) {
  const acc = await PaymentAccountModel.findOne({ creatorId });
  return {
    connected: Boolean(acc?.paypalEmail),
    email: acc?.paypalEmail ?? '',
    configured: env.paypalConfigured,
    demo: env.paypalDemo,
  };
}
