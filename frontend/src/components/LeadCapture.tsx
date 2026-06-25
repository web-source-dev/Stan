'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { track } from '@/lib/track';

/** Storefront email-capture block. Posts to public lead capture + tracks the submit. */
export function LeadCapture({
  username,
  accent,
  heading,
  buttonLabel = 'Subscribe',
  dark = false,
  ink = '#0b0b12',
  sub = '#52525b',
  cardBg,
}: {
  username: string;
  accent: string;
  heading?: string;
  buttonLabel?: string;
  dark?: boolean;
  ink?: string;
  sub?: string;
  cardBg?: string;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const bg = cardBg || (dark ? 'rgba(255,255,255,0.08)' : '#ffffff');
  const inputBg = dark ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const inputBorder = dark ? 'rgba(255,255,255,0.14)' : '#dcdce4';

  function utm() {
    if (typeof window === 'undefined') return undefined;
    const p = new URLSearchParams(window.location.search);
    const source = p.get('utm_source') ?? '';
    const medium = p.get('utm_medium') ?? '';
    const campaign = p.get('utm_campaign') ?? '';
    return source || medium || campaign ? { source, medium, campaign } : undefined;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError('Please agree to receive emails to subscribe.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/leads', {
        method: 'POST',
        credentials: false,
        body: { username, email, firstName: firstName || undefined, source: 'storefront', consent: true, utm: utm() },
      });
      track(username, 'lead_submit');
      setDone(true);
    } catch {
      setError('Could not subscribe right now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full min-h-[44px] rounded-xl border px-3.5 py-2.5 text-sm shadow-xs outline-none transition focus:ring-4 focus:ring-brand-500/15';

  return (
    <div
      className="rounded-2xl border p-5 shadow-soft backdrop-blur-xl"
      style={{ backgroundColor: bg, borderColor: inputBorder }}
    >
      <h3 className="text-base font-semibold" style={{ color: ink }}>{heading || 'Stay in the loop'}</h3>
      {done ? (
        <div
          className={`mt-3 flex animate-scale-in items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium motion-reduce:animate-none ${dark ? '' : 'bg-success-50 text-success-700'}`}
          style={dark ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#86efac' } : undefined}
        >
          ✓ You&apos;re on the list. Thanks!
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2.5">
          <input
            type="text"
            placeholder="First name (optional)"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: ink }}
          />
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: ink }}
          />
          <label className="flex items-start gap-2 text-xs" style={{ color: sub }}>
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-brand-600" />
            <span>I agree to receive emails.</span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !consent}
            className="w-full min-h-[44px] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-105 active:scale-[0.98] motion-reduce:active:scale-100 disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {busy ? 'Joining…' : buttonLabel}
          </button>
        </form>
      )}
    </div>
  );
}
