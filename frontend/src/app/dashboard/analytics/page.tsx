'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton } from '@/components/ui';
import { IconEye, IconDollar, IconUsers, IconGlobe, IconExternal } from '@/components/icons';
import { cn } from '@/lib/cn';

interface Summary {
  days: number;
  views: number;
  revenueCents: number;
  productClicks: number;
  checkoutStarts: number;
  leadSubmits: number;
  orders: number;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RangePill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-semibold transition',
        active
          ? 'bg-[#3a36db] text-white shadow-[0_4px_14px_-4px_rgba(58,54,219,0.5)]'
          : 'bg-[#f1f1f5] text-[#1a1c3a] hover:bg-[#e7e7ec]',
        !onClick && 'cursor-default',
      )}
    >
      {children}
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn('rounded-2xl border-2 border-transparent p-5', highlight && 'border-[#e64bf5]')}>
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
        <span className="text-neutral-400">{icon}</span> {label}
      </div>
      <div className="mt-2 text-[40px] font-bold leading-none tracking-tight text-[#1a1c3a]">{value}</div>
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
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Summary | null>(initialData ?? null);

  const load = useCallback(async () => {
    setData(null);
    const res = await authedRequest<Summary>(`/api/events/insights/summary?days=${days}`);
    setData(res);
  }, [authedRequest, days]);

  useEffect(() => {
    if (initialData !== undefined) return;
    void load();
  }, [load, initialData]);

  const rangeLabel = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return `${fmtDay(start)} - ${fmtDay(end)}`;
  }, [days]);

  const revenue = data ? `$${(data.revenueCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

  return (
    <>
      {/* Date range pills */}
      <div className="flex flex-wrap gap-2.5">
        <RangePill active={days === 7} onClick={() => setDays(7)}>Last 7 Days</RangePill>
        <RangePill active={days === 14} onClick={() => setDays(14)}>Last 14 Days</RangePill>
        <RangePill>{rangeLabel}</RangePill>
        <RangePill onClick={() => setDays(30)} active={days === 30}>Custom Range</RangePill>
      </div>

      {/* Headline stats card */}
      <div className="mt-5 min-h-[440px] rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
        {data === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid items-start gap-2 sm:grid-cols-3">
            <Stat icon={<IconEye size={18} />} label="Store Visits" value={data.views} />
            <Stat icon={<IconDollar size={18} />} label="Total Revenue" value={revenue} />
            <Stat icon={<IconUsers size={18} />} label="Leads" value={data.leadSubmits} highlight />
          </div>
        )}
      </div>

      {/* Customer geography */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <GeoCard
          title="Where are my customers from?"
          icon={<IconGlobe size={18} />}
          hint="Visitor locations appear here as your traffic grows."
        />
        <GeoCard
          title="Where do my customers go?"
          icon={<IconExternal size={18} />}
          hint="Outbound link clicks from your store appear here."
        />
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
