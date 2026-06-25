'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { IconChart, IconArrowRight } from '@/components/icons';

/* ---------------------------------------------------------------- */
/* Shared types + utils for both the per-store and global portals    */
/* ---------------------------------------------------------------- */
export interface MonthlyPoint {
  month: string;
  spentCents: number;
  orders: number;
}

export const INPUT =
  'w-full rounded-xl border border-line-strong bg-white px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

export function money(cents: number, currency = 'usd') {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() });
}

export function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  return json;
}

/* ---------------------------------------------------------------- */
/* Segmented OTP input                                              */
/* ---------------------------------------------------------------- */
export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button type="button" onClick={() => ref.current?.focus()} className="relative block w-full" tabIndex={-1}>
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        maxLength={6}
      />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const active = value.length === i;
          const filled = i < value.length;
          return (
            <div
              key={i}
              className={`flex h-14 flex-1 items-center justify-center rounded-xl border-2 text-2xl font-bold text-ink transition ${
                active
                  ? 'border-brand-500 ring-4 ring-brand-500/15'
                  : filled
                    ? 'border-line-strong bg-surface-subtle'
                    : 'border-line'
              }`}
            >
              {value[i] ?? ''}
            </div>
          );
        })}
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Spend chart (12-month CSS bars)                                   */
/* ---------------------------------------------------------------- */
export function SpendChart({
  monthly, cur, title = 'Spending · last 12 months',
}: { monthly: MonthlyPoint[]; cur: string; title?: string }) {
  const max = Math.max(0, ...monthly.map((m) => m.spentCents));
  const empty = max === 0;
  const activeMonths = monthly.filter((m) => m.spentCents > 0).length;
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <IconChart size={15} />
          </span>
          {title}
        </h2>
        {!empty && (
          <span className="text-xs font-medium text-neutral-400">
            Peak {money(max, cur)} · {activeMonths} active month{activeMonths === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="relative h-36">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-line/70" />
          ))}
        </div>
        <div className="relative flex h-full items-end gap-1 sm:gap-1.5">
          {monthly.map((m) => {
            const pct = max ? (m.spentCents / max) * 100 : 0;
            const has = m.spentCents > 0;
            return (
              <div key={m.month} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                {has && (
                  <div className="pointer-events-none absolute -top-9 z-10 hidden flex-col items-center group-hover:flex">
                    <div className="whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[11px] font-semibold text-white shadow-lift">
                      {money(m.spentCents, cur)}
                    </div>
                    <div className="-mt-1 h-2 w-2 rotate-45 bg-ink" />
                  </div>
                )}
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    has ? 'bg-brand-500 group-hover:bg-brand-600' : 'bg-surface-sunken/70'
                  }`}
                  style={{ height: has ? `${Math.max(pct, 8)}%` : '4px' }}
                />
              </div>
            );
          })}
        </div>
        {empty && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-neutral-400">
              No spending in the last 12 months
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {monthly.map((m) => {
          const [y, mo] = m.month.split('-');
          const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short' });
          return (
            <span key={m.month} className="flex-1 text-center text-[10px] font-medium text-neutral-400">
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Small reusable bits                                               */
/* ---------------------------------------------------------------- */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white shadow-xs'
          : 'border border-line bg-white text-neutral-600 hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function SearchInput({
  value, onChange, placeholder, className = '',
}: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-success-50 text-success-700',
    refunded: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${map[status] ?? 'bg-surface-sunken text-neutral-500'}`}>
      {status}
    </span>
  );
}

export function MiniEmpty({ onReset, label = 'No items match.' }: { onReset: () => void; label?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-white py-12 text-center text-sm text-neutral-500">
      {label}{' '}
      <button className="font-semibold text-brand-600 hover:text-brand-700" onClick={onReset}>
        Clear filters
      </button>
    </div>
  );
}

export function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-xs ${accent ? 'border-brand-100 bg-brand-50/60' : 'border-line bg-white'}`}>
      {icon && (
        <div className={`mb-2 grid h-8 w-8 place-items-center rounded-lg ${accent ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-neutral-500'}`}>
          {icon}
        </div>
      )}
      <div className={`text-2xl font-bold tracking-tight ${accent ? 'text-brand-700' : 'text-ink'}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-neutral-500">{label}</div>
    </div>
  );
}

export function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
        <span className="text-brand-600">{icon}</span> {title}
        {typeof count === 'number' && <span className="font-semibold text-neutral-400">· {count}</span>}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function RowLink({
  href, cover, fallbackIcon, title, sub, cta, children,
}: {
  href: string;
  cover?: string;
  fallbackIcon?: React.ReactNode;
  title: string;
  sub: string;
  cta: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface-sunken text-neutral-400">
          {fallbackIcon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">{title}</div>
        <div className="text-sm text-neutral-500">{sub}</div>
        {children}
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
        {cta} <IconArrowRight size={14} />
      </span>
    </Link>
  );
}
