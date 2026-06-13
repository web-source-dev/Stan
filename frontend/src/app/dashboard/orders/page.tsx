'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, Badge, EmptyState, Skeleton, Button, FilterChips, Field, Select } from '@/components/ui';
import { IconBag, IconDownload, IconSettings, IconDollar } from '@/components/icons';
import { formatPrice } from '@/lib/types';

interface Order {
  id: string;
  buyerEmail: string;
  amountCents: number;
  currency: string;
  status: string;
  fulfilmentStatus: string;
  product: { title: string; slug: string; kind?: string } | null;
  createdAt: string;
}

function statusTone(s: string): 'success' | 'warn' | 'danger' | 'neutral' {
  if (s === 'paid' || s === 'fulfilled') return 'success';
  if (s === 'pending' || s === 'processing') return 'warn';
  if (s === 'refunded' || s === 'failed' || s === 'cancelled') return 'danger';
  return 'neutral';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/* Revenue area chart (dependency-free SVG)                            */
/* ------------------------------------------------------------------ */

function RevenueChart({ orders }: { orders: Order[] }) {
  const days = 14;
  const series = useMemo(() => {
    const buckets: { label: string; ms: number; cents: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({
        label: d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ms: d.getTime(),
        cents: 0,
      });
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

  const W = 720;
  const H = 180;
  const max = Math.max(1, ...series.map((s) => s.cents));
  const step = series.length > 1 ? W / (series.length - 1) : W;
  const pts = series.map((s, i) => {
    const x = i * step;
    const y = H - (s.cents / max) * (H - 20) - 8;
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const ticks = [0, Math.floor(days / 2), days - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b54e8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#5b54e8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rev)" />
        <path d={line} fill="none" stroke="#5b54e8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between px-1 text-2xs text-neutral-400">
        {ticks.map((t) => (
          <span key={t}>{series[t]?.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payout panel                                                        */
/* ------------------------------------------------------------------ */

function PayoutPanel() {
  return (
    <Card className="bg-surface-subtle">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Available for cashout</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{formatPrice(0)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Available soon</div>
          <div className="mt-1 text-sm font-semibold text-neutral-700">{formatPrice(0)}</div>
        </div>
      </div>
      <Button variant="secondary" fullWidth className="mt-4" disabled>
        <IconDollar size={16} /> Cash Out
      </Button>
      <a
        href="/dashboard/settings"
        className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        <IconSettings size={15} /> Payout settings
      </a>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

type FilterKey = 'date' | 'email' | 'product' | 'amount' | 'status';
const FILTER_CHIPS: { value: FilterKey; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'product', label: 'Product' },
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
];

interface FilterState {
  email: string;
  product: string;
  status: string;
  minAmount: string;
  from: string;
  to: string;
}
const EMPTY_FILTERS: FilterState = { email: '', product: '', status: '', minAmount: '', from: '', to: '' };

function toCsv(orders: Order[]): string {
  const head = ['Date', 'Email', 'Product', 'Amount', 'Status', 'Fulfilment'];
  const rows = orders.map((o) => [
    new Date(o.createdAt).toISOString(),
    o.buyerEmail,
    o.product?.title ?? '',
    (o.amountCents / 100).toFixed(2),
    o.status,
    o.fulfilmentStatus,
  ]);
  return [head, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/* ------------------------------------------------------------------ */

function IncomeView() {
  const { authedRequest } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [summary, setSummary] = useState<{ revenueCents: number; orders: number } | null>(null);
  const [active, setActive] = useState<FilterKey[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const load = useCallback(async () => {
    const res = await authedRequest<{ orders: Order[] }>('/api/orders');
    setOrders(res.orders);
    authedRequest<{ revenueCents: number; orders: number; publishedProducts: number }>('/api/orders/summary')
      .then(setSummary)
      .catch(() => {});
  }, [authedRequest]);

  useEffect(() => { void load(); }, [load]);

  const productOptions = useMemo(
    () => Array.from(new Set((orders ?? []).map((o) => o.product?.title).filter(Boolean) as string[])),
    [orders],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set((orders ?? []).map((o) => o.status))),
    [orders],
  );

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (active.includes('email') && filters.email && !o.buyerEmail.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (active.includes('product') && filters.product && o.product?.title !== filters.product) return false;
      if (active.includes('status') && filters.status && o.status !== filters.status) return false;
      if (active.includes('amount') && filters.minAmount && o.amountCents < Math.round(parseFloat(filters.minAmount) * 100)) return false;
      if (active.includes('date') && filters.from && new Date(o.createdAt) < new Date(filters.from)) return false;
      if (active.includes('date') && filters.to && new Date(o.createdAt) > new Date(filters.to + 'T23:59:59')) return false;
      return true;
    });
  }, [orders, active, filters]);

  function toggleChip(k: FilterKey) {
    setActive((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
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

  return (
    <DashboardShell
      title="Income"
      subtitle="Your revenue, payouts and every order in one place."
      maxWidth="max-w-6xl"
    >
      {/* Revenue + payout */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total revenue · 30d</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">
            {summary ? formatPrice(summary.revenueCents) : <span className="text-neutral-300">$0.00</span>}
          </div>
          <div className="mt-4">
            {orders === null ? <Skeleton className="h-44 w-full" /> : <RevenueChart orders={orders} />}
          </div>
        </Card>
        <PayoutPanel />
      </div>

      {/* Latest orders */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Latest Orders</h2>
          <Button variant="secondary" size="sm" onClick={download} disabled={!filtered.length}>
            <IconDownload size={15} /> Download CSV
          </Button>
        </div>

        <div className="mt-4">
          <FilterChips chips={FILTER_CHIPS} active={active} onToggle={toggleChip} />
        </div>

        {active.length > 0 && (
          <Card className="mt-3" padded>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              )}
              {active.includes('amount') && (
                <Field label="Min amount ($)" type="number" min="0" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} placeholder="0" />
              )}
              {active.includes('date') && (
                <>
                  <Field label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
                  <Field label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
                </>
              )}
            </div>
          </Card>
        )}

        <div className="mt-4">
          {orders === null ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<IconBag size={24} />}
              title={orders.length === 0 ? 'No orders yet' : 'No transactions matching filters'}
              description={
                orders.length === 0
                  ? 'When someone buys a product, course or paid booking, it shows up here.'
                  : 'Update or clear your filters to find what you’re looking for.'
              }
            />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-surface-subtle text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Buyer</th>
                      <th className="px-5 py-3 font-medium">Product</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Fulfilment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr key={o.id} className="border-b border-line transition last:border-0 hover:bg-surface-subtle">
                        <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{fmtDate(o.createdAt)}</td>
                        <td className="px-5 py-3 font-medium">{o.buyerEmail}</td>
                        <td className="px-5 py-3 text-neutral-600">
                          {o.product ? (
                            <span className="inline-flex items-center gap-2">
                              <span>{o.product.title}</span>
                              {o.product.kind && o.product.kind !== 'product' && <Badge tone="neutral">{o.product.kind}</Badge>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-semibold">{o.amountCents ? formatPrice(o.amountCents, o.currency) : 'Free'}</td>
                        <td className="px-5 py-3"><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                        <td className="px-5 py-3 text-right"><Badge tone={statusTone(o.fulfilmentStatus)}>{o.fulfilmentStatus}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function IncomePage() {
  return <IncomeView />;
}
