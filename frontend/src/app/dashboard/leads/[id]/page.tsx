'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton, Alert } from '@/components/ui';
import {
  IconUsers, IconMail, IconArrowLeft, IconDownload, IconExternal,
  IconCalendar, IconBook, IconCheckCircle,
} from '@/components/icons';
import { cn } from '@/lib/cn';
import { SpendChart } from '@/components/portal/ui';

/* ------------------------------------------------------------------ */
/* Types + helpers                                                     */
/* ------------------------------------------------------------------ */

interface CustomerDetail {
  contact: {
    id: string; email: string; firstName: string; lastName: string; phone: string;
    source: string; tags: string[]; isCustomer: boolean; unsubscribed: boolean;
    consent: boolean; optInStatus: string;
    utm: { source: string; medium: string; campaign: string };
    createdAt: string;
  };
  summary: {
    paidOrders: number; totalOrders: number; spentCents: number; refundedCents: number;
    netCents: number; aovCents: number; firstPurchaseAt: string | null; lastPurchaseAt: string | null;
    currency: string; productsOwned: number; coursesOwned: number; bookings: number;
  };
  orders: {
    id: string; productTitle: string; amountCents: number; currency: string; status: string;
    fulfilmentStatus: string; source: string; discountCode: string;
    createdAt: string; paidAt: string | null; refundedAt: string | null;
  }[];
  products: { id: string; title: string; coverImageUrl: string; downloadCount: number; lastAccessedAt: string | null; grantedAt: string; revoked: boolean }[];
  courses: { id: string; title: string; coverImageUrl: string; completed: number; total: number; revoked: boolean }[];
  bookings: { id: string; title: string; startAt: string; timezone: string; whenText: string; status: string; displayStatus: string; meetingUrl: string; upcoming: boolean }[];
  monthly: { month: string; spentCents: number; orders: number }[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
}
function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
const STATUS_TONE: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  refunded: 'bg-amber-50 text-amber-700',
  pending: 'bg-neutral-100 text-neutral-600',
  failed: 'bg-red-50 text-red-700',
};
const BOOKING_TONE: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  'in progress': 'bg-brand-50 text-brand-700',
  completed: 'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-red-50 text-red-600',
  'pending payment': 'bg-amber-50 text-amber-700',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_3px_rgba(15,15,25,0.04)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-[#1a1c3a]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1a1c3a]">
        {title}
        {count !== undefined && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-neutral-500">{count}</span>}
      </h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function CustomerDetailContent({ id }: { id: string }) {
  const { authedRequest } = useAuth();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null); setError('');
    authedRequest<CustomerDetail>(`/api/leads/manage/${id}/detail`)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e instanceof ApiException ? e.message : 'Could not load this customer.'); });
    return () => { active = false; };
  }, [authedRequest, id]);

  const backLink = (
    <Link href="/dashboard/leads" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-ink">
      <IconArrowLeft size={16} /> Back to customers
    </Link>
  );

  if (error) {
    return (
      <div>
        {backLink}
        <Alert kind="error">{error}</Alert>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        {backLink}
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  const name = [data.contact.firstName, data.contact.lastName].filter(Boolean).join(' ') || data.contact.email;
  const initials = (data.contact.firstName?.[0] || data.contact.email[0] || '?').toUpperCase() + (data.contact.lastName?.[0] || '').toUpperCase();

  return (
    <div>
      {backLink}

      <div className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)] sm:p-7">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
            {initials.trim() || <IconUsers size={22} />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[#1a1c3a]">{name}</h1>
            <a href={`mailto:${data.contact.email}`} className="inline-flex items-center gap-1.5 truncate text-sm text-brand-600 hover:underline">
              <IconMail size={14} /> {data.contact.email}
            </a>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={cn('rounded-full px-2.5 py-1', data.contact.isCustomer ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-600')}>
            {data.contact.isCustomer ? 'Customer' : 'Subscriber'}
          </span>
          {data.contact.unsubscribed && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Unsubscribed</span>}
          {data.contact.source && <span className="rounded-full bg-surface-muted px-2.5 py-1 capitalize text-neutral-600">via {data.contact.source}</span>}
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-neutral-600">Joined {fmtDate(data.contact.createdAt)}</span>
        </div>

        {/* Stat cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Lifetime spend" value={fmtMoney(data.summary.netCents)} sub={data.summary.refundedCents ? `${fmtMoney(data.summary.refundedCents)} refunded` : undefined} />
          <StatCard label="Paid orders" value={String(data.summary.paidOrders)} sub={data.summary.totalOrders !== data.summary.paidOrders ? `${data.summary.totalOrders} total` : undefined} />
          <StatCard label="Avg order" value={fmtMoney(data.summary.aovCents)} />
          <StatCard label="Owns" value={`${data.summary.productsOwned + data.summary.coursesOwned}`} sub={`${data.summary.productsOwned} product${data.summary.productsOwned === 1 ? '' : 's'} · ${data.summary.coursesOwned} course${data.summary.coursesOwned === 1 ? '' : 's'}`} />
        </div>

        {(data.summary.firstPurchaseAt || data.summary.lastPurchaseAt) && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
            {data.summary.firstPurchaseAt && <span>First purchase: <span className="font-semibold text-neutral-700">{fmtDate(data.summary.firstPurchaseAt)}</span></span>}
            {data.summary.lastPurchaseAt && <span>Last purchase: <span className="font-semibold text-neutral-700">{fmtDate(data.summary.lastPurchaseAt)}</span></span>}
          </div>
        )}

        {/* Spend chart */}
        <div className="mt-5">
          <SpendChart monthly={data.monthly} cur={data.summary.currency} title="Spend · last 12 months" />
        </div>

        {/* Orders */}
        <Section title="Orders" count={data.orders.length}>
          {data.orders.length === 0 ? (
            <p className="text-sm text-neutral-500">No orders yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-sm">
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-line/70 last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[#1a1c3a]">{o.productTitle}</div>
                        <div className="text-xs text-neutral-400">
                          {fmtDate(o.paidAt || o.createdAt)}{o.discountCode ? ` · code ${o.discountCode}` : ''}{o.source ? ` · ${o.source}` : ''}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-[#1a1c3a]">{fmtMoney(o.amountCents)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_TONE[o.status] ?? 'bg-neutral-100 text-neutral-600')}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Products */}
        {data.products.length > 0 && (
          <Section title="Products owned" count={data.products.length}>
            <ul className="space-y-2">
              {data.products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-50 text-brand-600">
                    {p.coverImageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
                      : <IconDownload size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1a1c3a]">{p.title}{p.revoked && <span className="ml-2 text-xs font-normal text-red-500">revoked</span>}</span>
                    <span className="text-xs text-neutral-400">
                      {p.downloadCount} download{p.downloadCount === 1 ? '' : 's'}{p.lastAccessedAt ? ` · last opened ${fmtDate(p.lastAccessedAt)}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Courses */}
        {data.courses.length > 0 && (
          <Section title="Courses" count={data.courses.length}>
            <ul className="space-y-2">
              {data.courses.map((c) => {
                const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><IconBook size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#1a1c3a]">{c.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-xs text-neutral-400">{c.completed}/{c.total}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* Bookings */}
        {data.bookings.length > 0 && (
          <Section title="Bookings" count={data.bookings.length}>
            <ul className="space-y-2">
              {data.bookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><IconCalendar size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1a1c3a]">{b.title}</span>
                    <span className="text-xs text-neutral-400">{b.whenText} · {b.timezone}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', BOOKING_TONE[b.displayStatus] ?? 'bg-neutral-100 text-neutral-600')}>{b.displayStatus}</span>
                    {b.meetingUrl && b.upcoming && <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-brand-600"><IconExternal size={14} /></a>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Contact details */}
        <Section title="Contact details">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-line bg-white p-4 text-sm">
            <div><dt className="text-xs text-neutral-400">Phone</dt><dd className="font-medium text-[#1a1c3a]">{data.contact.phone || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-400">Email opt-in</dt><dd className="font-medium capitalize text-[#1a1c3a]">{data.contact.unsubscribed ? 'Unsubscribed' : data.contact.optInStatus}</dd></div>
            <div><dt className="text-xs text-neutral-400">Source</dt><dd className="font-medium capitalize text-[#1a1c3a]">{data.contact.source || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-400">Marketing consent</dt><dd className="font-medium text-[#1a1c3a]">{data.contact.consent ? <span className="inline-flex items-center gap-1 text-emerald-600"><IconCheckCircle size={13} /> Yes</span> : 'No'}</dd></div>
            {(data.contact.utm.source || data.contact.utm.campaign) && (
              <div className="col-span-2"><dt className="text-xs text-neutral-400">Acquisition (UTM)</dt><dd className="font-medium text-[#1a1c3a]">{[data.contact.utm.source, data.contact.utm.medium, data.contact.utm.campaign].filter(Boolean).join(' / ')}</dd></div>
            )}
            {data.contact.tags.length > 0 && (
              <div className="col-span-2">
                <dt className="mb-1 text-xs text-neutral-400">Tags</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {data.contact.tags.map((t) => <span key={t} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">{t}</span>)}
                </dd>
              </div>
            )}
          </dl>
        </Section>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  return (
    <DashboardShell title="Customer" maxWidth="max-w-3xl" hideTitle hideSubtitle>
      <CustomerDetailContent id={id} />
    </DashboardShell>
  );
}
