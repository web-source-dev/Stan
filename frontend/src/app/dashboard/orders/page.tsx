'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton, Field, Select, Badge } from '@/components/ui';
import { IconDownload, IconSettings, IconPlus, IconHelp } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Order {
  id: string;
  buyerEmail: string;
  amountCents: number;
  currency: string;
  status: string;
  fulfilmentStatus: string;
  discountCode?: string;
  paymentProvider?: string;
  product: { title: string; slug: string; kind?: string } | null;
  createdAt: string;
}

/** Human label for the rail that settled an order (drives the Payment filter). */
function paymentOf(o: Order): string {
  switch (o.paymentProvider) {
    case 'paypal': return 'PayPal';
    case 'free': return 'Free';
    case 'manual': return 'Manual';
    case 'stripe': return 'Card';
    default: return o.amountCents > 0 ? 'Card' : 'Free';
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTone(s: string): 'success' | 'warn' | 'danger' | 'neutral' {
  if (s === 'paid' || s === 'fulfilled') return 'success';
  if (s === 'pending' || s === 'processing') return 'warn';
  if (s === 'refunded' || s === 'failed' || s === 'cancelled') return 'danger';
  return 'neutral';
}

/* ------------------------------------------------------------------ */
/* Revenue area chart (dependency-free SVG)                            */
/* ------------------------------------------------------------------ */

function RevenueChart({ orders }: { orders: Order[] }) {
  const days = 28;
  const series = useMemo(() => {
    const buckets: { label: string; ms: number; cents: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }), ms: d.getTime(), cents: 0 });
    }
    for (const o of orders) {
      if (o.status !== 'paid') continue;
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      const b = buckets.find((x) => x.ms === d.getTime());
      if (b) b.cents += o.amountCents;
    }
    return buckets;
  }, [orders]);

  const W = 960;
  const H = 200;
  const max = Math.max(1, ...series.map((s) => s.cents));
  const step = series.length > 1 ? W / (series.length - 1) : W;
  const pts = series.map((s, i) => ({ x: i * step, y: H - (s.cents / max) * (H - 24) - 10 }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const tickIdx = Array.from({ length: 10 }, (_, i) => Math.round((i / 9) * (series.length - 1)));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6355fa" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6355fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rev)" />
        <path d={line} fill="none" stroke="#6355fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-neutral-400">
        {tickIdx.map((t, i) => (
          <span key={i}>{series[t]?.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payout panel                                                        */
/* ------------------------------------------------------------------ */

function PayoutPanel({ summary }: { summary: { revenueCents: number; orders: number } | null }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const gross = summary?.revenueCents ?? 0;
  return (
    <div className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-[0_12px_40px_-12px_rgba(15,15,25,0.12),0_2px_8px_rgba(15,15,25,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-neutral-500">Available for Cashout</div>
          <div className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#1a1c3a]">{formatPrice(0)}</div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-medium text-neutral-500">Available Soon</div>
          <div className="mt-1 text-[15px] font-semibold text-neutral-400">{formatPrice(0)}</div>
        </div>
      </div>
      <div className="mt-2 text-right">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {showBreakdown ? 'Hide breakdown' : 'View breakdown'}
        </button>
      </div>

      {showBreakdown && (
        <dl className="mt-3 space-y-2 rounded-2xl bg-surface-subtle p-4 text-sm">
          <div className="flex justify-between"><dt className="text-neutral-500">Revenue (last 30 days)</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Available for cashout</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(0)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Available soon</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(0)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2"><dt className="text-neutral-500">Paid out to date</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(0)}</dd></div>
        </dl>
      )}

      {/* Spacer pushes the actions to the bottom so the card fills its row. */}
      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled
          title="Connect a payout account in Settings to cash out"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#eceef3] py-4 text-[15px] font-bold text-neutral-400"
        >
          <IconPlus size={18} /> Cash Out
        </button>
        <a
          href="/dashboard/settings?tab=payments"
          className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          <IconSettings size={16} /> Settings
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

type FilterKey = 'date' | 'email' | 'product' | 'amount' | 'discount' | 'payment' | 'status' | 'fulfilment';
const FILTER_CHIPS: { value: FilterKey; label: string }[] = [
  { value: 'date', label: 'Date & Time' },
  { value: 'email', label: 'Email' },
  { value: 'product', label: 'Product' },
  { value: 'amount', label: 'Amount' },
  { value: 'discount', label: 'Discount Code' },
  { value: 'payment', label: 'Payment Method' },
  { value: 'status', label: 'Status' },
  { value: 'fulfilment', label: 'Fulfilment' },
];

interface FilterState {
  email: string;
  product: string;
  status: string;
  fulfilment: string;
  minAmount: string;
  maxAmount: string;
  from: string;
  to: string;
  discount: string;
  payment: string;
}
const EMPTY_FILTERS: FilterState = { email: '', product: '', status: '', fulfilment: '', minAmount: '', maxAmount: '', from: '', to: '', discount: '', payment: '' };

function toCsv(orders: Order[]): string {
  const head = ['Date', 'Email', 'Product', 'Amount', 'Status', 'Fulfilment', 'Discount Code', 'Payment Method'];
  const rows = orders.map((o) => [
    new Date(o.createdAt).toISOString(),
    o.buyerEmail,
    o.product?.title ?? '',
    (o.amountCents / 100).toFixed(2),
    o.status,
    o.fulfilmentStatus,
    o.discountCode ?? '',
    paymentOf(o),
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/** Purple "$" smiley empty-state illustration. */
function EmptyTransactions() {
  return (
    <div className="py-16 text-center">
      <div className="relative mx-auto mb-6 h-[104px] w-[120px]">
        <span className="absolute left-7 top-0 -rotate-[14deg] text-[30px] font-extrabold text-brand-600">$</span>
        <span className="absolute left-2 top-9 h-3 w-1 -rotate-[20deg] rounded-full bg-brand-500/70" />
        <span className="absolute right-3 top-7 h-2.5 w-1 rotate-[20deg] rounded-full bg-brand-500/70" />
        <div className="absolute bottom-0 left-1/2 grid h-[80px] w-[80px] -translate-x-1/2 place-items-center rounded-full bg-brand-600">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
            <ellipse cx="16.5" cy="18" rx="2.4" ry="4.2" fill="#fff" />
            <ellipse cx="27.5" cy="18" rx="2.4" ry="4.2" fill="#fff" />
            <path d="M14 26.5c1.8 3.2 5 3.6 8 3.6s6.2-.4 8-3.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
      <h3 className="text-xl font-bold text-[#1a1c3a]">No Transactions Matching Filters</h3>
      <p className="mt-1.5 text-sm font-medium text-brand-600">Update filters to find what you&apos;re looking for!</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function IncomeContent({ initialOrders }: { initialOrders?: Order[] }) {
  const { authedRequest } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(initialOrders ?? null);
  const [summary, setSummary] = useState<{ revenueCents: number; orders: number } | null>(null);
  const [active, setActive] = useState<FilterKey[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const load = useCallback(async () => {
    const res = await authedRequest<{ orders: Order[] }>('/api/orders');
    setOrders(res.orders);
    authedRequest<{ revenueCents: number; orders: number }>('/api/orders/summary')
      .then(setSummary)
      .catch(() => {});
  }, [authedRequest]);

  useEffect(() => { if (initialOrders) return; void load(); }, [load, initialOrders]);

  const productOptions = useMemo(
    () => Array.from(new Set((orders ?? []).map((o) => o.product?.title).filter(Boolean) as string[])).sort(),
    [orders],
  );
  const statusOptions = useMemo(() => Array.from(new Set((orders ?? []).map((o) => o.status))).sort(), [orders]);
  const fulfilmentOptions = useMemo(
    () => Array.from(new Set((orders ?? []).map((o) => o.fulfilmentStatus).filter(Boolean))).sort(),
    [orders],
  );
  const paymentOptions = useMemo(
    () => Array.from(new Set((orders ?? []).map(paymentOf))).sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    if (!orders) return [];
    // Local-day boundaries so the From/To dates are inclusive and timezone-safe.
    const fromMs = active.includes('date') && filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
    const toMs = active.includes('date') && filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : null;
    const minCents = active.includes('amount') && filters.minAmount.trim() !== '' ? Math.round(parseFloat(filters.minAmount) * 100) : null;
    const maxCents = active.includes('amount') && filters.maxAmount.trim() !== '' ? Math.round(parseFloat(filters.maxAmount) * 100) : null;

    return orders.filter((o) => {
      const created = new Date(o.createdAt).getTime();
      if (active.includes('email') && filters.email && !o.buyerEmail.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (active.includes('product') && filters.product && o.product?.title !== filters.product) return false;
      if (active.includes('status') && filters.status && o.status !== filters.status) return false;
      if (active.includes('fulfilment') && filters.fulfilment && o.fulfilmentStatus !== filters.fulfilment) return false;
      if (minCents !== null && !Number.isNaN(minCents) && o.amountCents < minCents) return false;
      if (maxCents !== null && !Number.isNaN(maxCents) && o.amountCents > maxCents) return false;
      if (fromMs !== null && created < fromMs) return false;
      if (toMs !== null && created > toMs) return false;
      if (active.includes('discount') && filters.discount && !(o.discountCode ?? '').toLowerCase().includes(filters.discount.toLowerCase())) return false;
      if (active.includes('payment') && filters.payment && paymentOf(o) !== filters.payment) return false;
      return true;
    });
  }, [orders, active, filters]);

  // Total of paid orders in the current filtered view (so the figure tracks filters).
  const filteredRevenueCents = useMemo(
    () => filtered.reduce((sum, o) => (o.status === 'paid' ? sum + o.amountCents : sum), 0),
    [filtered],
  );

  function toggleChip(k: FilterKey) {
    setActive((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function clearFilters() {
    setActive([]);
    setFilters(EMPTY_FILTERS);
  }

  function download() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilterInputs = active.length > 0;

  return (
    <>
      {/* Revenue + payout */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">
            Total Revenue
            <span title="Total paid revenue over the last 30 days" className="inline-flex text-neutral-400">
              <IconHelp size={15} />
            </span>
          </div>
          <div className="mt-1 text-[64px] font-bold leading-[1.05] tracking-tight text-[#1a1c3a]">
            {summary ? formatPrice(summary.revenueCents) : '$0.00'}
          </div>
          <div className="mt-10">
            {orders === null ? <Skeleton className="h-[200px] w-full" /> : <RevenueChart orders={orders} />}
          </div>
        </div>
        <PayoutPanel summary={summary} />
      </div>

      {/* Latest orders */}
      <div className="mt-6 rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Latest Orders</h2>
          <button
            type="button"
            onClick={download}
            disabled={orders === null}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f1f5] px-4 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-[#e7e7ec] disabled:opacity-60"
          >
            <IconDownload size={15} /> Download CSV
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {FILTER_CHIPS.map((c) => {
            const on = active.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleChip(c.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
                  on ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100',
                )}
              >
                <span className="text-base leading-none">{on ? '×' : '+'}</span>
                {c.label}
              </button>
            );
          })}
        </div>

        {hasFilterInputs && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-subtle p-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.includes('email') && (
              <Field label="Email contains" value={filters.email} onChange={(e) => setFilters({ ...filters, email: e.target.value })} placeholder="name@email.com" />
            )}
            {active.includes('product') && (
              <Select label="Product" value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}>
                <option value="">Any product</option>
                {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            )}
            {active.includes('status') && (
              <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Any status</option>
                {statusOptions.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </Select>
            )}
            {active.includes('fulfilment') && (
              <Select label="Fulfilment" value={filters.fulfilment} onChange={(e) => setFilters({ ...filters, fulfilment: e.target.value })}>
                <option value="">Any fulfilment</option>
                {fulfilmentOptions.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </Select>
            )}
            {active.includes('amount') && (
              <Field label="Min amount ($)" type="number" min="0" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} placeholder="0" />
            )}
            {active.includes('amount') && (
              <Field label="Max amount ($)" type="number" min="0" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })} placeholder="Any" />
            )}
            {active.includes('date') && (
              <>
                <Field label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
                <Field label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
              </>
            )}
            {active.includes('discount') && (
              <Field label="Discount code contains" value={filters.discount} onChange={(e) => setFilters({ ...filters, discount: e.target.value })} placeholder="e.g. SUMMER20" />
            )}
            {active.includes('payment') && (
              <Select label="Payment method" value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })}>
                <option value="">Any method</option>
                {paymentOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            )}
          </div>
        )}

        {/* Results summary */}
        {orders !== null && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-neutral-500">
              Showing <span className="font-bold text-[#1a1c3a]">{filtered.length}</span>
              {filtered.length !== orders.length && <> of {orders.length}</> } order{filtered.length === 1 ? '' : 's'}
              <span className="mx-2 text-neutral-300">·</span>
              <span className="font-bold text-emerald-600">{formatPrice(filteredRevenueCents)}</span> paid
            </span>
            {active.length > 0 && (
              <button type="button" onClick={clearFilters} className="font-semibold text-brand-600 hover:text-brand-700">
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[15px] font-bold text-[#1a1c3a]">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4">Method</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            {orders !== null && filtered.length > 0 && (
              <tbody className="text-sm">
                {filtered.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="whitespace-nowrap py-3 pr-4 text-neutral-500">{fmtDate(o.createdAt)}</td>
                    <td className="py-3 pr-4 font-medium text-[#1a1c3a]">{o.buyerEmail}</td>
                    <td className="py-3 pr-4 text-neutral-600">
                      <span className="inline-flex items-center gap-2">
                        {o.product?.title ?? '—'}
                        {o.product?.kind && o.product.kind !== 'product' && <Badge tone="neutral">{o.product.kind}</Badge>}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                        paymentOf(o) === 'PayPal' ? 'bg-[#e8f3ff] text-[#003087]'
                          : paymentOf(o) === 'Free' ? 'bg-neutral-100 text-neutral-500'
                          : 'bg-brand-50 text-brand-600',
                      )}>
                        {paymentOf(o)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-semibold text-[#1a1c3a]">
                      {o.amountCents ? formatPrice(o.amountCents, o.currency) : 'Free'}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {orders === null ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : filtered.length === 0 ? (
            <EmptyTransactions />
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function IncomePage() {
  return (
    <DashboardShell title="Income" maxWidth="max-w-[1280px]" hideSubtitle hideTitle>
      <IncomeContent />
    </DashboardShell>
  );
}
