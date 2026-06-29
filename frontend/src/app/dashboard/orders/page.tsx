'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton, Field, Select, Badge, Textarea, Alert } from '@/components/ui';
import { IconDownload, IconSettings, IconPlus, IconHelp, IconBox, IconX } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ApiException } from '@/lib/api';
import { useMediaLibrary } from '@/components/media/MediaLibrary';

interface Order {
  id: string;
  buyerEmail: string;
  buyerName?: string;
  amountCents: number;
  currency: string;
  status: string;
  fulfilmentStatus: string;
  discountCode?: string;
  paymentProvider?: string;
  needsFulfillment?: boolean;
  product: { title: string; slug: string; kind?: string; productKind?: string } | null;
  createdAt: string;
  paidAt: string;
}

interface OrderDetail {
  id: string;
  buyerEmail: string;
  buyerName: string;
  amountCents: number;
  currency: string;
  status: string;
  fulfilmentStatus: string;
  fulfillmentMessage: string;
  fulfillmentDeliveryUrl: string;
  fulfillmentAssets: { publicId: string; resourceType: string; filename: string; bytes: number; format: string }[];
  buyerCustomFields: { label: string; value: string }[];
  product: { title: string; productKind: string; fulfilmentNote: string };
  paidAt: string;
}

interface IncomeSummary {
  revenueCents: number;
  platformFeesCents: number;
  netRevenueCents: number;
  orders: number;
  lifetimeRevenueCents: number;
  lifetimePlatformFeesCents: number;
  lifetimeNetRevenueCents: number;
  lifetimeOrders: number;
  windowDays: number;
  payouts: {
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    availableCents: number;
    pendingCents: number;
    currency: string;
  };
}

interface RevenuePoint {
  date: string;
  label: string;
  revenueCents: number;
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

function orderDate(o: Order): string {
  return o.paidAt || o.createdAt;
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

function productKindBadge(o: Order) {
  if (o.product?.kind && o.product.kind !== 'product') {
    return <Badge tone="neutral">{o.product.kind}</Badge>;
  }
  const kind = o.product?.productKind;
  if (!kind || kind === 'digital') return null;
  return <Badge tone="neutral">{kind}</Badge>;
}

function FulfillOrderModal({
  orderId,
  onClose,
  onFulfilled,
}: {
  orderId: string;
  onClose: () => void;
  onFulfilled: () => void;
}) {
  const { authedRequest } = useAuth();
  const { open: openMediaLibrary } = useMediaLibrary();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [message, setMessage] = useState('');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [assets, setAssets] = useState<OrderDetail['fulfillmentAssets']>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authedRequest<{ order: OrderDetail }>(`/api/orders/${orderId}`);
        setDetail(res.order);
        setMessage(res.order.fulfillmentMessage);
        setDeliveryUrl(res.order.fulfillmentDeliveryUrl);
        setAssets(res.order.fulfillmentAssets ?? []);
      } catch (err) {
        setError(err instanceof ApiException ? err.message : 'Could not load order');
      } finally {
        setLoading(false);
      }
    })();
  }, [authedRequest, orderId]);

  function pickFile() {
    openMediaLibrary({
      accept: 'file',
      kind: 'product_file',
      title: 'Attach delivery file',
      onSelect: (m) => {
        setAssets((prev) => [
          ...prev,
          { publicId: m.publicId, resourceType: m.resourceType, filename: m.filename, bytes: m.bytes, format: m.format },
        ]);
      },
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await authedRequest(`/api/orders/${orderId}/fulfill`, {
        method: 'POST',
        body: { message, deliveryUrl, assets },
      });
      onFulfilled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not deliver order');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1a1c3a]">Deliver custom order</h2>
            {detail && (
              <p className="mt-1 text-sm text-neutral-500">
                {detail.product.title} · {detail.buyerEmail}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <IconX size={18} />
          </button>
        </div>

        {loading ? (
          <Skeleton className="mt-6 h-48 w-full" />
        ) : detail ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {error && <Alert kind="error">{error}</Alert>}

            {detail.buyerCustomFields.length > 0 && (
              <div className="rounded-xl border border-line bg-surface-subtle/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Buyer details</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.buyerCustomFields.map((f) => (
                    <li key={f.label}>
                      <span className="font-medium text-[#1a1c3a]">{f.label}: </span>
                      <span className="text-neutral-600">{f.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.product.fulfilmentNote && (
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span className="font-semibold">Your delivery promise: </span>
                {detail.product.fulfilmentNote}
              </p>
            )}

            <Textarea
              label="Message to buyer"
              optional
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thanks for your order! Here is your personalized delivery…"
            />

            <Field
              label="Delivery link (optional)"
              optional
              type="url"
              value={deliveryUrl}
              onChange={(e) => setDeliveryUrl(e.target.value)}
              placeholder="https://…"
            />

            <div>
              <p className="text-sm font-medium text-[#1a1c3a]">Files</p>
              {assets.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {assets.map((a, i) => (
                    <li key={`${a.publicId}-${i}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                      <span className="truncate font-medium">{a.filename}</span>
                      <button
                        type="button"
                        onClick={() => setAssets((prev) => prev.filter((_, idx) => idx !== i))}
                        className="ml-2 shrink-0 text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={pickFile}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-brand-300 hover:text-brand-600"
              >
                <IconPlus size={14} /> Add file
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <IconBox size={16} /> {busy ? 'Delivering…' : 'Mark delivered'}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-6 text-sm text-red-600">{error || 'Order not found'}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Revenue area chart (dependency-free SVG)                            */
/* ------------------------------------------------------------------ */

function RevenueChart({ series }: { series: RevenuePoint[] }) {
  const W = 960;
  const H = 200;
  const max = Math.max(1, ...series.map((s) => s.revenueCents));
  const step = series.length > 1 ? W / (series.length - 1) : W;
  const pts = series.map((s, i) => ({
    x: i * step,
    y: H - (s.revenueCents / max) * (H - 24) - 10,
  }));
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

function PayoutPanel({
  summary,
  onCashOut,
  cashOutBusy,
}: {
  summary: IncomeSummary | null;
  onCashOut: () => void;
  cashOutBusy: boolean;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const gross = summary?.revenueCents ?? 0;
  const available = summary?.payouts.availableCents ?? 0;
  const pending = summary?.payouts.pendingCents ?? 0;
  const lifetime = summary?.lifetimeRevenueCents ?? 0;
  const lifetimeFees = summary?.lifetimePlatformFeesCents ?? 0;
  const stripeConnected = summary?.payouts.connected ?? false;
  const canCashOut = stripeConnected && summary?.payouts.chargesEnabled && available > 0;
  const fundsPending = stripeConnected && pending > 0 && available <= 0;

  return (
    <div className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-[0_12px_40px_-12px_rgba(15,15,25,0.12),0_2px_8px_rgba(15,15,25,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-neutral-500">Available for Cashout</div>
          <div className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#1a1c3a]">
            {formatPrice(available)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-medium text-neutral-500">Available Soon</div>
          <div className="mt-1 text-[15px] font-semibold text-neutral-400">{formatPrice(pending)}</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        {stripeConnected
          ? summary?.payouts.payoutsEnabled
            ? 'Live balance from your Stripe Connect account. Stripe also deducts card processing fees.'
            : 'Stripe connected — finish payout verification in Stripe to enable bank transfers.'
          : 'Connect Stripe in Settings to accept card payments and see payout balances.'}
      </p>

      {fundsPending && (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-900">
          <strong>{formatPrice(pending)}</strong> is still settling in Stripe (shown as &ldquo;Available soon&rdquo;).
          It usually moves to &ldquo;Available for cashout&rdquo; within a few business days.
          Cash Out turns on once that balance is available — then you transfer to your bank in Stripe.
        </div>
      )}

      {!canCashOut && stripeConnected && available <= 0 && pending <= 0 && summary?.payouts.chargesEnabled && (
        <div className="mt-3 rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-xs text-neutral-600">
          No Stripe balance yet. After customers pay, funds appear here as pending, then available for cash out.
        </div>
      )}
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
          <div className="flex justify-between"><dt className="text-neutral-500">Gross revenue ({summary?.windowDays ?? 30}d)</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Platform fees ({summary?.windowDays ?? 30}d)</dt><dd className="font-semibold text-[#1a1c3a]">−{formatPrice(summary?.platformFeesCents ?? 0)}</dd></div>
          <div className="flex justify-between border-b border-line pb-2"><dt className="text-neutral-500">Net after platform fees ({summary?.windowDays ?? 30}d)</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(summary?.netRevenueCents ?? 0)}</dd></div>
          <div className="flex justify-between pt-1"><dt className="text-neutral-500">Lifetime gross</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(lifetime)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Lifetime platform fees</dt><dd className="font-semibold text-[#1a1c3a]">−{formatPrice(lifetimeFees)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Available for cashout</dt><dd className="font-semibold text-emerald-700">{formatPrice(available)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Available soon</dt><dd className="font-semibold text-[#1a1c3a]">{formatPrice(pending)}</dd></div>
        </dl>
      )}

      {/* Spacer pushes the actions to the bottom so the card fills its row. */}
      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled={!canCashOut || cashOutBusy}
          title={
            !stripeConnected
              ? 'Connect Stripe in Settings → Payments'
              : !canCashOut
                ? fundsPending
                  ? `${formatPrice(pending)} is still settling — Cash Out opens when Available for cashout is above $0`
                  : 'No available balance yet — funds may still be pending in Stripe'
                : 'Open your Stripe Express dashboard to transfer to your bank'
          }
          onClick={onCashOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#eceef3] py-4 text-[15px] font-bold text-neutral-400 enabled:bg-brand-600 enabled:text-white enabled:hover:bg-brand-700 disabled:cursor-not-allowed"
        >
          <IconPlus size={18} /> {cashOutBusy ? 'Opening Stripe…' : 'Cash Out'}
        </button>
        {stripeConnected && !canCashOut && (
          <button
            type="button"
            onClick={onCashOut}
            disabled={cashOutBusy}
            className="mt-3 w-full text-center text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            View payout schedule in Stripe →
          </button>
        )}
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
    new Date(orderDate(o)).toISOString(),
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

/** Purple "$" smiley — no sales yet. */
function EmptySales() {
  return (
    <div className="py-16 text-center">
      <div className="relative mx-auto mb-6 h-[104px] w-[120px]">
        <span className="absolute left-7 top-0 -rotate-[14deg] text-[30px] font-extrabold text-brand-600">$</span>
        <div className="absolute bottom-0 left-1/2 grid h-[80px] w-[80px] -translate-x-1/2 place-items-center rounded-full bg-brand-600">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
            <ellipse cx="16.5" cy="18" rx="2.4" ry="4.2" fill="#fff" />
            <ellipse cx="27.5" cy="18" rx="2.4" ry="4.2" fill="#fff" />
            <path d="M14 26.5c1.8 3.2 5 3.6 8 3.6s6.2-.4 8-3.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
      <h3 className="text-xl font-bold text-[#1a1c3a]">No sales yet</h3>
      <p className="mt-1.5 text-sm text-neutral-500">
        Paid product, course, and booking purchases appear here after checkout completes.
      </p>
    </div>
  );
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
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [series, setSeries] = useState<RevenuePoint[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cashOutBusy, setCashOutBusy] = useState(false);
  const [active, setActive] = useState<FilterKey[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [fulfillOrderId, setFulfillOrderId] = useState<string | null>(null);

  const pendingFulfillmentCount = useMemo(
    () => (orders ?? []).filter((o) => o.needsFulfillment).length,
    [orders],
  );

  const load = useCallback(async () => {
    setLoadError('');
    const [ordersRes, summaryRes, seriesRes] = await Promise.allSettled([
      authedRequest<{ orders: Order[] }>('/api/orders'),
      authedRequest<IncomeSummary>('/api/orders/summary'),
      authedRequest<{ series: RevenuePoint[] }>('/api/orders/timeseries'),
    ]);

    if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.orders);
    else setOrders([]);

    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
    else setSummary(null);

    if (seriesRes.status === 'fulfilled') setSeries(seriesRes.value.series);
    else setSeries([]);

    const failed = [ordersRes, summaryRes, seriesRes].filter((r) => r.status === 'rejected');
    if (failed.length === 3) setLoadError('Could not load income data. Is the backend running?');
    else if (failed.length > 0) setLoadError('Some income data failed to load. Try refreshing.');
  }, [authedRequest]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  async function cashOut() {
    setCashOutBusy(true);
    try {
      const res = await authedRequest<{ url: string }>('/api/orders/payouts/login', { method: 'POST' });
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch {
      window.open('https://dashboard.stripe.com/connect/balance', '_blank', 'noopener,noreferrer');
    } finally {
      setCashOutBusy(false);
    }
  }

  useEffect(() => { if (initialOrders) return; void load(); }, [load, initialOrders]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

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
      const created = new Date(orderDate(o)).getTime();
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
      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}{' '}
          <button type="button" onClick={() => void refresh()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Revenue + payout */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">
              Total Revenue
              <span title={`Gross customer payments over the last ${summary?.windowDays ?? 30} days (before platform & Stripe fees)`} className="inline-flex text-neutral-400">
                <IconHelp size={15} />
              </span>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="rounded-full bg-[#f1f1f5] px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-[#e7e7ec] disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="mt-1 text-[64px] font-bold leading-[1.05] tracking-tight text-[#1a1c3a]">
            {summary ? formatPrice(summary.revenueCents) : orders === null ? '—' : '$0.00'}
          </div>
          {summary && (
            <p className="mt-1 text-sm text-neutral-500">
              {summary.orders} paid order{summary.orders === 1 ? '' : 's'} (30d)
              {summary.platformFeesCents > 0 && (
                <> · {formatPrice(summary.netRevenueCents)} net after {formatPrice(summary.platformFeesCents)} platform fees</>
              )}
              {' · '}{formatPrice(summary.lifetimeRevenueCents)} lifetime gross
            </p>
          )}
          <div className="mt-10">
            {series === null ? <Skeleton className="h-[200px] w-full" /> : <RevenueChart series={series} />}
          </div>
        </div>
        <PayoutPanel summary={summary} onCashOut={() => void cashOut()} cashOutBusy={cashOutBusy} />
      </div>

      {/* Latest orders */}
      <div className="mt-6 rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
        {pendingFulfillmentCount > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">{pendingFulfillmentCount} custom order{pendingFulfillmentCount === 1 ? '' : 's'}</span>
            {' '}waiting for delivery. Use <span className="font-semibold">Deliver</span> to send files or a link to the buyer.
          </div>
        )}
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
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            {orders !== null && filtered.length > 0 && (
              <tbody className="text-sm">
                {filtered.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="whitespace-nowrap py-3 pr-4 text-neutral-500">{fmtDate(orderDate(o))}</td>
                    <td className="py-3 pr-4 font-medium text-[#1a1c3a]">{o.buyerEmail}</td>
                    <td className="py-3 pr-4 text-neutral-600">
                      <span className="inline-flex items-center gap-2">
                        {o.product?.title ?? '—'}
                        {productKindBadge(o)}
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
                    <td className="py-3 pr-4">
                      {o.needsFulfillment ? (
                        <button
                          type="button"
                          onClick={() => setFulfillOrderId(o.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-200"
                        >
                          <IconBox size={13} /> Deliver
                        </button>
                      ) : (
                        <Badge tone={statusTone(o.fulfilmentStatus)} className="capitalize">{o.fulfilmentStatus}</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <div className="font-semibold text-[#1a1c3a]">
                        {o.amountCents ? formatPrice(o.amountCents, o.currency) : 'Free'}
                      </div>
                      {o.status !== 'paid' && (
                        <Badge tone={statusTone(o.status)} className="mt-0.5 capitalize">{o.status}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {orders === null ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : orders.length === 0 ? (
            <EmptySales />
          ) : filtered.length === 0 ? (
            <EmptyTransactions />
          ) : null}
        </div>
      </div>

      {fulfillOrderId && (
        <FulfillOrderModal
          orderId={fulfillOrderId}
          onClose={() => setFulfillOrderId(null)}
          onFulfilled={() => void refresh()}
        />
      )}
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
