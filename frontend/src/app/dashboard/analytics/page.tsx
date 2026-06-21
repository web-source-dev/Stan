'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { usePlan } from '@/lib/use-plan';
import { FeatureLock } from '@/components/FeatureLock';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton } from '@/components/ui';
import {
  IconEye, IconDollar, IconUsers, IconGlobe, IconExternal, IconLock, IconTrending, IconBag, IconCard,
} from '@/components/icons';
import { cn } from '@/lib/cn';

interface Summary {
  range: { days: number; from: string; to: string };
  filtered: { productId: string; source: string };
  totals: {
    views: number; uniqueVisitors: number; productClicks: number; ctaClicks: number;
    checkoutStarts: number; leadSubmits: number; orders: number; revenueCents: number; aovCents: number;
  };
  rates: { visitToCheckout: number; checkoutToOrder: number; leadConversion: number; viewToOrder: number };
  timeseries: { date: string; views: number; orders: number; revenueCents: number }[];
  topProducts: { id: string; title: string; orders: number; revenueCents: number }[];
  topSources: { source: string; orders: number; revenueCents: number }[];
  filters: { products: { id: string; title: string }[]; sources: string[] };
}

type Preset = '7' | '14' | '30' | '90' | 'custom';
type ChartMetric = 'revenue' | 'views' | 'orders';

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const SELECT = 'rounded-full border border-line-strong bg-white px-3.5 py-2 text-sm font-semibold text-ink outline-none transition hover:border-brand-400 focus:border-brand-500';

function RangePill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-semibold transition',
        active ? 'bg-[#3a36db] text-white shadow-[0_4px_14px_-4px_rgba(58,54,219,0.5)]' : 'bg-[#f1f1f5] text-[#1a1c3a] hover:bg-[#e7e7ec]',
        !onClick && 'cursor-default',
      )}
    >
      {children}
    </button>
  );
}

function Stat({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-2xl border-2 border-transparent p-5', highlight && 'border-[#e64bf5]')}>
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
        <span className="text-neutral-400">{icon}</span> {label}
      </div>
      <div className="mt-2 text-[40px] font-bold leading-none tracking-tight text-[#1a1c3a]">{value}</div>
      {sub && <div className="mt-2 text-sm text-neutral-400">{sub}</div>}
    </div>
  );
}

function RateCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl bg-surface-subtle p-4">
      <div className="text-2xl font-bold tracking-tight text-[#1a1c3a]">{value}%</div>
      <div className="mt-1 text-xs font-semibold text-[#1a1c3a]">{label}</div>
      <div className="text-xs text-neutral-400">{hint}</div>
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface-subtle p-4 text-center">
      <div className="text-2xl font-bold tracking-tight text-[#1a1c3a]">{value}</div>
      <div className="mt-1 text-xs font-medium text-neutral-500">{label}</div>
    </div>
  );
}

function TimeseriesChart({ data, metric }: { data: Summary['timeseries']; metric: ChartMetric }) {
  const value = (d: Summary['timeseries'][number]) => (metric === 'revenue' ? d.revenueCents : metric === 'views' ? d.views : d.orders);
  const fmt = (n: number) => (metric === 'revenue' ? money(n) : String(n));
  const max = Math.max(1, ...data.map(value));
  // Keep the axis readable: label first, middle, last.
  const labelIdx = new Set([0, Math.floor(data.length / 2), data.length - 1]);
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px]">
        {data.map((d, i) => {
          const v = value(d);
          const h = Math.round((v / max) * 100);
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end" title={`${shortDay(d.date)} · ${fmt(v)}`}>
              <div
                className={cn('w-full rounded-t-[3px] transition', v > 0 ? 'bg-brand-500 group-hover:bg-brand-600' : 'bg-surface-muted')}
                style={{ height: `${Math.max(h, v > 0 ? 4 : 1.5)}%` }}
              />
              {labelIdx.has(i) && <span className="absolute -bottom-5 whitespace-nowrap text-[10px] text-neutral-400">{shortDay(d.date)}</span>}
            </div>
          );
        })}
      </div>
      <div className="h-5" />
    </div>
  );
}

function TopList({ title, icon, rows, emptyHint }: {
  title: string;
  icon: React.ReactNode;
  rows: { key: string; label: string; orders: number; revenueCents: number }[];
  emptyHint: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenueCents));
  return (
    <div className="rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
      <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a1c3a]">{icon} {title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">{emptyHint}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold capitalize text-[#1a1c3a]">{r.label}</span>
                <span className="shrink-0 font-bold text-[#1a1c3a]">{money(r.revenueCents)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round((r.revenueCents / max) * 100)}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-neutral-400">{r.orders} order{r.orders === 1 ? '' : 's'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GeoCard({ title, icon, hint }: { title: string; icon: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
      <h3 className="text-lg font-bold tracking-tight text-[#1a1c3a]">{title}</h3>
      <div className="mt-5 grid h-44 place-items-center rounded-2xl border border-dashed border-line-strong bg-surface-subtle text-center">
        <div className="text-neutral-400">
          <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-500">{icon}</span>
          <p className="text-sm">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function AnalyticsContent({ initialData }: { initialData?: Summary | null }) {
  const { authedRequest } = useAuth();
  const { features } = usePlan();
  const advanced = features ? features.advancedAnalytics : true; // don't flash-lock while loading
  const locked = !advanced;

  const [preset, setPreset] = useState<Preset>('14');
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [productId, setProductId] = useState('');
  const [source, setSource] = useState('');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue');
  const [data, setData] = useState<Summary | null>(initialData ?? null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (preset === 'custom' && from && to) {
      p.set('from', from);
      p.set('to', to);
    } else {
      p.set('days', preset === 'custom' ? '14' : preset);
    }
    if (advanced) {
      if (productId) p.set('productId', productId);
      if (source) p.set('source', source);
    }
    return p.toString();
  }, [preset, from, to, productId, source, advanced]);

  const load = useCallback(async () => {
    setData(null);
    const res = await authedRequest<Summary>(`/api/events/insights/summary?${query}`);
    setData(res);
  }, [authedRequest, query]);

  useEffect(() => {
    if (initialData !== undefined) return;
    void load();
  }, [load, initialData]);

  const rangeLabel = useMemo(() => {
    if (!data) return '';
    return `${fmtDay(new Date(data.range.from))} – ${fmtDay(new Date(data.range.to))}`;
  }, [data]);

  const filtersActive = Boolean(productId || source || preset === '30' || preset === '90' || preset === 'custom');

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <RangePill active={preset === '7'} onClick={() => setPreset('7')}>Last 7 Days</RangePill>
        <RangePill active={preset === '14'} onClick={() => setPreset('14')}>Last 14 Days</RangePill>
        {locked ? (
          <Link
            href="/dashboard/settings?tab=billing"
            title="Upgrade for longer ranges, filters and reports"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f1f5] px-4 py-2 text-sm font-semibold text-neutral-400 hover:bg-[#e7e7ec]"
          >
            <IconLock size={14} /> Last 30 Days
          </Link>
        ) : (
          <>
            <RangePill active={preset === '30'} onClick={() => setPreset('30')}>Last 30 Days</RangePill>
            <RangePill active={preset === '90'} onClick={() => setPreset('90')}>Last 90 Days</RangePill>
            <RangePill active={preset === 'custom'} onClick={() => setPreset('custom')}>Custom</RangePill>
          </>
        )}
      </div>

      {/* Advanced filters */}
      {advanced && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {preset === 'custom' && (
            <div className="flex items-center gap-2 rounded-full bg-[#f1f1f5] px-3 py-1.5">
              <input type="date" value={from} max={to || todayISO()} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-sm font-semibold text-ink outline-none" />
              <span className="text-neutral-400">→</span>
              <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-sm font-semibold text-ink outline-none" />
            </div>
          )}
          {data && data.filters.products.length > 0 && (
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={SELECT} title="Filter by product">
              <option value="">All products</option>
              {data.filters.products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          {data && data.filters.sources.length > 0 && (
            <select value={source} onChange={(e) => setSource(e.target.value)} className={SELECT} title="Filter by source">
              <option value="">All sources</option>
              {data.filters.sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {filtersActive && (
            <button
              type="button"
              onClick={() => { setPreset('14'); setProductId(''); setSource(''); }}
              className="rounded-full px-3 py-2 text-sm font-semibold text-neutral-500 hover:text-ink"
            >
              Clear
            </button>
          )}
          {rangeLabel && <span className="ml-auto text-sm text-neutral-400">{rangeLabel}</span>}
        </div>
      )}

      {/* Headline stats */}
      <div className="mt-5 rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
        {data === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<IconEye size={18} />} label="Store Visits" value={data.totals.views} sub={`${data.totals.uniqueVisitors} unique`} />
            <Stat icon={<IconDollar size={18} />} label="Revenue" value={money(data.totals.revenueCents)} sub={`${data.totals.orders} order${data.totals.orders === 1 ? '' : 's'}`} />
            <Stat icon={<IconCard size={18} />} label="Avg Order" value={money(data.totals.aovCents)} />
            <FeatureLock locked={locked} compact>
              <Stat icon={<IconUsers size={18} />} label="Leads" value={data.totals.leadSubmits} highlight />
            </FeatureLock>
          </div>
        )}
      </div>

      {/* Trend chart — advanced */}
      {!locked && data && (
        <div className="mt-5 rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a1c3a]">
              <IconTrending size={18} /> Trend
            </h3>
            <div className="flex rounded-full bg-surface-subtle p-1">
              {(['revenue', 'views', 'orders'] as ChartMetric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition', chartMetric === m ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-ink')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <TimeseriesChart data={data.timeseries} metric={chartMetric} />
          </div>
        </div>
      )}

      {/* Conversion funnel + rates — advanced */}
      {!locked && data && (
        <div className="mt-5 rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a1c3a]">
            <IconTrending size={18} /> Conversion funnel
          </h3>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            <FunnelStep label="Store visits" value={data.totals.views} />
            <FunnelStep label="Product clicks" value={data.totals.productClicks} />
            <FunnelStep label="Checkouts started" value={data.totals.checkoutStarts} />
            <FunnelStep label="Orders" value={data.totals.orders} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <RateCard label="Visit → Checkout" value={data.rates.visitToCheckout} hint="of visitors start checkout" />
            <RateCard label="Checkout → Order" value={data.rates.checkoutToOrder} hint="of checkouts convert" />
            <RateCard label="Visit → Order" value={data.rates.viewToOrder} hint="overall conversion" />
            <RateCard label="Lead capture" value={data.rates.leadConversion} hint="of visitors join your list" />
          </div>
        </div>
      )}

      {/* Top products + sources — advanced */}
      {!locked && data && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TopList
            title="Top products"
            icon={<IconBag size={18} />}
            rows={data.topProducts.map((p) => ({ key: p.id, label: p.title, orders: p.orders, revenueCents: p.revenueCents }))}
            emptyHint="Product sales will appear here once you make sales in this range."
          />
          <TopList
            title="Top sources"
            icon={<IconGlobe size={18} />}
            rows={data.topSources.map((s) => ({ key: s.source, label: s.source, orders: s.orders, revenueCents: s.revenueCents }))}
            emptyHint="Where your sales come from will appear here."
          />
        </div>
      )}

      {/* Customer geography — Pro feature placeholder */}
      <div className="mt-5">
        <FeatureLock locked={locked} label="Customer insights are a Pro feature">
          <div className="grid gap-5 lg:grid-cols-2">
            <GeoCard title="Where are my customers from?" icon={<IconGlobe size={18} />} hint="Visitor locations appear here as your traffic grows." />
            <GeoCard title="Where do my customers go?" icon={<IconExternal size={18} />} hint="Outbound link clicks from your store appear here." />
          </div>
        </FeatureLock>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <DashboardShell title="Analytics" maxWidth="max-w-[1280px]" hideSubtitle hideTitle>
      <AnalyticsContent />
    </DashboardShell>
  );
}
