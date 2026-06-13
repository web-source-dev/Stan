'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, Skeleton } from '@/components/ui';
import { IconEye, IconDollar, IconUsers, IconArrowRight } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Summary {
  days: number;
  views: number;
  revenueCents: number;
  productClicks: number;
  checkoutStarts: number;
  leadSubmits: number;
  orders: number;
  visitToCheckoutRate: number;
  checkoutToOrderRate: number;
  leadConversionRate: number;
}

const RANGES = [
  { days: 7, label: 'Last 7 Days' },
  { days: 14, label: 'Last 14 Days' },
  { days: 30, label: 'Last 30 Days' },
];

function AnalyticsView() {
  const { authedRequest } = useAuth();
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setData(null);
    const res = await authedRequest<Summary>(`/api/events/insights/summary?days=${days}`);
    setData(res);
  }, [authedRequest, days]);
  useEffect(() => { void load(); }, [load]);

  return (
    <DashboardShell title="Analytics" subtitle="Understand your traffic, revenue and conversions." maxWidth="max-w-6xl">
      {/* Range chips */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              days === r.days ? 'bg-brand-600 text-white shadow-soft' : 'bg-surface-muted text-neutral-600 hover:bg-surface-sunken',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Top tiles */}
      <Card className="mt-6">
        {data === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            <Tile icon={<IconEye size={18} />} label="Store Visits" value={String(data.views)} />
            <Tile icon={<IconDollar size={18} />} label="Total Revenue" value={formatPrice(data.revenueCents)} />
            <Tile icon={<IconUsers size={18} />} label="Leads" value={String(data.leadSubmits)} highlight />
          </div>
        )}
      </Card>

      {/* Conversion funnel */}
      {data && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold tracking-tight">Conversion funnel</h2>
          <p className="mt-0.5 text-sm text-neutral-500">From storefront visit to completed order.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Store visits', value: data.views, rate: null as string | null },
              { label: 'Checkouts started', value: data.checkoutStarts, rate: `${data.visitToCheckoutRate}%` },
              { label: 'Orders', value: data.orders, rate: `${data.checkoutToOrderRate}%` },
            ].map((step, i) => (
              <div key={step.label} className="relative rounded-xl border border-line bg-surface-subtle p-4">
                <div className="text-2xl font-bold tracking-tight">{step.value}</div>
                <div className="mt-0.5 text-sm text-neutral-600">{step.label}</div>
                {step.rate && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {step.rate} conversion
                  </div>
                )}
                {i < 2 && <IconArrowRight size={18} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-neutral-300 sm:block" />}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Geo placeholders — wired when geo capture lands */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Where are my customers from?</h3>
          <div className="mt-4 grid h-40 place-items-center rounded-xl border border-dashed border-line-strong bg-surface-subtle text-sm text-neutral-400">
            Geo insights appear as traffic grows.
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Where do my customers go?</h3>
          <div className="mt-4 grid h-40 place-items-center rounded-xl border border-dashed border-line-strong bg-surface-subtle text-sm text-neutral-400">
            Outbound link clicks appear here.
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Tile({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl p-1', highlight && 'ring-2 ring-brand-200')}>
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span className="text-brand-500">{icon}</span> {label}
      </div>
      <div className="mt-1.5 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
