'use client';

import { useState } from 'react';
import { apiRequest, ApiException } from '@/lib/api';
import { formatPrice } from '@/lib/types';
import { track } from '@/lib/track';

/**
 * Client-side buy action for a storefront product card. Creates a Checkout
 * Session on the backend and redirects to Stripe's hosted checkout.
 */
export function BuyButton({
  username,
  slug,
  priceCents,
  currency,
  label,
  accent,
}: {
  username: string;
  slug: string;
  priceCents: number;
  currency: string;
  label: string;
  accent: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isFree = priceCents <= 0;

  async function buy() {
    setBusy(true);
    setError('');
    track(username, 'checkout_start');
    // Free products use the claim flow (which needs the buyer's email). Send
    // them to the product page where that form lives, rather than the paid
    // checkout session, which the backend rejects for $0 items.
    if (isFree) {
      window.location.href = `/${username}/product/${slug}`;
      return;
    }
    try {
      const res = await apiRequest<{ url: string }>('/api/checkout/session', {
        method: 'POST',
        body: { username, slug, source: 'storefront' },
        credentials: false,
      });
      window.location.href = res.url;
    } catch (err) {
      setError(
        err instanceof ApiException && err.code === 'stripe_unconfigured'
          ? 'Payments are not set up yet.'
          : err instanceof ApiException
            ? err.message
            : 'Could not start checkout',
      );
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={buy}
        disabled={busy}
        className="mt-3 w-full min-h-[44px] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-105 active:scale-[0.98] motion-reduce:active:scale-100 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {busy ? 'Redirecting…' : isFree ? label || 'Get it free' : `${label || 'Buy now'} · ${formatPrice(priceCents, currency)}`}
      </button>
      {error && <p className="mt-1.5 text-xs font-medium text-danger-600">{error}</p>}
    </>
  );
}
