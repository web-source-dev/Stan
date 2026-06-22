'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiException } from '@/lib/api';
import { track } from '@/lib/track';
import { formatPrice } from '@/lib/types';

/** Enroll (free) or buy (paid) a course. Free enroll redirects to the player. */
export function CourseCTA({
  username,
  slug,
  priceCents,
  currency,
  accent,
}: {
  username: string;
  slug: string;
  priceCents: number;
  currency: string;
  accent: string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paypal, setPaypal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (priceCents <= 0) return;
    apiRequest<{ paypal: boolean }>(`/api/checkout/payment-methods/${encodeURIComponent(username)}`, { credentials: false })
      .then((m) => setPaypal(m.paypal))
      .catch(() => {});
  }, [username, priceCents]);

  async function start(provider: 'card' | 'paypal') {
    if (busy) return;
    setBusy(true);
    setError('');
    track(username, 'checkout_start');
    try {
      if (priceCents > 0) {
        const path = provider === 'paypal' ? '/api/checkout/paypal/course-session' : '/api/checkout/course-session';
        const res = await apiRequest<{ url: string }>(path, { method: 'POST', credentials: false, body: { username, slug, email } });
        window.location.href = res.url;
      } else {
        const res = await apiRequest<{ accessToken: string }>('/api/learn/enroll', {
          method: 'POST', credentials: false, body: { username, slug, email },
        });
        window.location.href = `/learn/${res.accessToken}`;
      }
    } catch (err) {
      setError(
        err instanceof ApiException && err.code === 'stripe_unconfigured'
          ? 'Payments are not set up yet.'
          : err instanceof ApiException ? err.message : 'Something went wrong',
      );
      setBusy(false);
    }
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    void start('card');
  }
  function payWithPayPal() {
    if (formRef.current && !formRef.current.reportValidity()) return;
    void start('paypal');
  }

  return (
    <form ref={formRef} onSubmit={go} className="mt-4 space-y-2.5">
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-sm shadow-xs outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-105 active:translate-y-px disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {busy ? 'Working…' : priceCents > 0 ? `Buy · ${formatPrice(priceCents, currency)}` : 'Enroll free'}
      </button>
      {priceCents > 0 && paypal && (
        <button
          type="button"
          onClick={payWithPayPal}
          disabled={busy}
          aria-label="Pay with PayPal"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ffc439] py-3 text-sm font-bold text-[#003087] transition hover:brightness-[1.03] disabled:opacity-60"
        >
          <span>Pay with</span>
          <span className="font-extrabold italic"><span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span></span>
        </button>
      )}
      {error && <p className="text-xs font-medium text-danger-600">{error}</p>}
    </form>
  );
}
