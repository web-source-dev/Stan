'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { IconCard, IconCheckCircle, IconLock, IconTrash } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface SavedCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

const INPUT =
  'w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

/* ---- card helpers (all client-side; raw PAN/CVC never leave the browser) ---- */

type Brand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'card';

function detectBrand(digits: string): Brand {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'discover';
  return 'card';
}

function brandLabel(b: string): string {
  return { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', card: 'Card' }[b] ?? 'Card';
}

/** Group digits for display: Amex 4-6-5, everything else in 4s. */
function formatCardNumber(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 19);
  const groups = detectBrand(d) === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + g));
    i += g;
  }
  return out.join(' ');
}

function formatExpiry(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Luhn checksum — rejects mistyped card numbers before we accept them. */
function luhnValid(digits: string): boolean {
  if (digits.length < 13) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/* ------------------------------------------------------------------ */

export function PaymentDetails({ card, onChange }: { card: SavedCard | null; onChange: (sub: unknown) => void }) {
  const { authedRequest } = useAuth();
  const [editing, setEditing] = useState(!card);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const digits = number.replace(/\D/g, '');
  const brand = detectBrand(digits);
  const cvcLen = brand === 'amex' ? 4 : 3;

  async function save() {
    setError('');
    // Validate fully in the browser; only masked data is ever sent.
    if (!luhnValid(digits)) { setError('Please enter a valid card number.'); return; }
    const [mm, yy] = expiry.split('/');
    const expMonth = Number(mm);
    const expYear = yy ? 2000 + Number(yy) : 0;
    if (!expMonth || expMonth < 1 || expMonth > 12 || !yy || yy.length !== 2) { setError('Enter a valid expiry date (MM/YY).'); return; }
    const now = new Date();
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      setError('That card has expired.'); return;
    }
    if (cvc.replace(/\D/g, '').length !== cvcLen) { setError(`Enter the ${cvcLen}-digit security code.`); return; }

    setBusy(true);
    try {
      // SECURITY: derive + send only the non-sensitive masked fields. The full
      // card number and CVC stay in this component's state and are discarded.
      const res = await authedRequest<{ subscription: unknown }>('/api/subscription/payment-method', {
        method: 'POST',
        body: { brand, last4: digits.slice(-4), expMonth, expYear },
      });
      onChange(res.subscription);
      setNumber(''); setExpiry(''); setCvc(''); // never retain raw card data
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not save your card.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await authedRequest<{ subscription: unknown }>('/api/subscription/payment-method', { method: 'DELETE' });
      onChange(res.subscription);
      setEditing(true);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not remove your card.');
    } finally {
      setBusy(false);
    }
  }

  // ---- Saved card summary ----
  if (card && !editing) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">Payment Details</h2>
        <div className="rounded-2xl border border-line bg-gradient-to-br from-[#f6f6fc] to-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#1a1c3a] shadow-xs">
              <IconCard size={15} className="text-brand-600" /> {brandLabel(card.brand)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-700"><IconCheckCircle size={14} /> On file</span>
          </div>
          <div className="mt-4 font-mono text-lg tracking-widest text-[#1a1c3a]">•••• •••• •••• {card.last4}</div>
          <div className="mt-1 text-sm text-neutral-500">
            Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => { setEditing(true); setError(''); }} className="rounded-full border border-brand-400 bg-white px-5 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50">
            Replace card
          </button>
          <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2.5 text-sm font-bold text-neutral-600 transition hover:border-danger-300 hover:text-danger-600 disabled:opacity-50">
            <IconTrash size={15} /> Remove
          </button>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-400"><IconLock size={12} /> We only store your card brand, last 4 digits and expiry.</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ---- Add / replace form ----
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">Payment Details</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-neutral-600">Card number</label>
          <div className="relative">
            <input
              className={cn(INPUT, 'pr-20 font-mono tracking-wider')}
              placeholder="1234 5678 9012 3456"
              inputMode="numeric"
              autoComplete="cc-number"
              name="cardnumber"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {digits.length >= 2 && brand !== 'card' ? (
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-600">{brandLabel(brand)}</span>
              ) : (
                <IconCard size={20} className="text-neutral-400" />
              )}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-neutral-600">Expiry (MM/YY)</label>
            <input
              className={cn(INPUT, 'font-mono')}
              placeholder="MM/YY"
              inputMode="numeric"
              autoComplete="cc-exp"
              name="cc-exp"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-neutral-600">Security code</label>
            <input
              className={cn(INPUT, 'font-mono')}
              placeholder={'•'.repeat(cvcLen)}
              inputMode="numeric"
              autoComplete="cc-csc"
              name="cvc"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, cvcLen))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={save} disabled={busy} className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save card'}
          </button>
          {card && (
            <button onClick={() => { setEditing(false); setError(''); setNumber(''); setExpiry(''); setCvc(''); }} className="rounded-full px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:text-ink">
              Cancel
            </button>
          )}
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
          <IconLock size={12} /> Your full card number and security code never leave your device — we save only the brand, last 4 digits and expiry.
        </p>
      </div>
    </div>
  );
}
