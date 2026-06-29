import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

/**
 * Minimal PayPal Orders API v2 client (REST), platform-level credentials.
 *
 * Flow: createOrder (intent=CAPTURE) → buyer approves at the returned link →
 * captureOrder. Funds route to each creator's connected PayPal email via the
 * purchase_unit `payee`. No SDK dependency — just the REST API.
 */

const BASE = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Currencies PayPal does not support with decimal sub-units (charge whole units). */
const ZERO_DECIMAL = new Set(['huf', 'jpy', 'twd']);

/** Convert integer cents to a PayPal amount string for the currency. */
function toAmount(cents: number, currency: string): string {
  if (ZERO_DECIMAL.has(currency.toLowerCase())) return String(Math.round(cents / 100));
  return (cents / 100).toFixed(2);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const creds = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !data?.access_token) {
    logger.error({ status: res.status }, 'PayPal token request failed');
    throw new AppError(502, 'paypal_error', 'Could not authenticate with PayPal');
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3000) * 1000 };
  return cachedToken.value;
}

async function ppFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as (T & {
    message?: string;
    details?: { issue?: string; description?: string }[];
  }) | null;
  if (!res.ok) {
    const detail = data?.details?.[0]?.description ?? data?.message ?? 'PayPal request failed';
    logger.error({ status: res.status, path, data }, 'PayPal API error');
    throw new AppError(502, 'paypal_error', detail);
  }
  return data as T;
}

export interface PayPalOrder {
  id: string;
  status: string;
  links: { href: string; rel: string; method: string }[];
}

/**
 * Create a CAPTURE order. `payeeEmail` (the creator's PayPal email) receives the
 * funds; `customId` carries our checkout-intent id. `returnUrl`/`cancelUrl` are
 * where PayPal redirects the buyer after the approval screen.
 */
export async function createOrder(input: {
  amountCents: number;
  currency: string;
  description?: string;
  payeeEmail?: string;
  customId: string;
  brandName?: string;
  returnUrl: string;
  cancelUrl: string;
  /** Platform application fee (deducted from payee, credited to platform merchant). */
  platformFeeCents?: number;
}): Promise<PayPalOrder> {
  const currency = input.currency.toUpperCase();
  const purchaseUnit: Record<string, unknown> = {
    amount: { currency_code: currency, value: toAmount(input.amountCents, input.currency) },
    description: input.description?.slice(0, 127),
    custom_id: input.customId,
    ...(input.payeeEmail ? { payee: { email_address: input.payeeEmail } } : {}),
  };
  if (input.platformFeeCents && input.platformFeeCents > 0) {
    purchaseUnit.payment_instruction = {
      platform_fees: [
        {
          amount: {
            currency_code: currency,
            value: toAmount(input.platformFeeCents, input.currency),
          },
        },
      ],
    };
  }
  return ppFetch<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
      application_context: {
        brand_name: input.brandName?.slice(0, 127) || 'CreatorStore',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });
}

/** The buyer-facing approval URL from a created order. */
export function approveUrl(order: PayPalOrder): string | null {
  return order.links.find((l) => l.rel === 'approve')?.href ?? null;
}

export interface PayPalCapture {
  id: string;
  status: string;
  payer?: { email_address?: string };
  purchase_units?: {
    custom_id?: string;
    payments?: { captures?: { id: string; status: string }[] };
  }[];
}

/** Capture an approved order. Idempotent on PayPal's side per order id. */
export async function captureOrder(orderId: string): Promise<PayPalCapture> {
  return ppFetch<PayPalCapture>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    // Body must be present (even empty) for the capture call.
    body: '{}',
  });
}

/** The first capture id from a capture response (used as the payment ref). */
export function captureId(cap: PayPalCapture): string | undefined {
  return cap.purchase_units?.[0]?.payments?.captures?.[0]?.id;
}

/**
 * Verify a webhook signature with PayPal. Returns true when PayPal confirms the
 * event is authentic. When no PAYPAL_WEBHOOK_ID is set we can't verify — callers
 * decide whether to trust unverified events (dev only).
 */
export async function verifyWebhookSignature(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean> {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const h = (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? '';
  const res = await ppFetch<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: h('paypal-auth-algo'),
      cert_url: h('paypal-cert-url'),
      transmission_id: h('paypal-transmission-id'),
      transmission_sig: h('paypal-transmission-sig'),
      transmission_time: h('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    }),
  }).catch(() => null);
  return res?.verification_status === 'SUCCESS';
}
