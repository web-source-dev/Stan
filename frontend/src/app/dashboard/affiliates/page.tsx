'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton, Badge } from '@/components/ui';
import { IconCopy, IconCheck } from '@/components/icons';
import { cn } from '@/lib/cn';

interface CommissionRow {
  id: string;
  productTitle: string;
  grossCents: number;
  commissionCents: number;
  commissionPercent: number;
  currency: string;
  status: 'pending' | 'paid' | 'void';
  buyerEmail: string;
  affiliateRef?: string;
  createdAt: string;
  paidAt?: string;
}

interface AffiliateProduct {
  id: string;
  title: string;
  slug: string;
  commissionPercent: number;
}

const fmtMoney = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

function AffiliatesView() {
  const { authedRequest } = useAuth();
  const [tab, setTab] = useState<'earnings' | 'sales' | 'links'>('sales');
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [copied, setCopied] = useState('');
  const [username, setUsername] = useState('');
  const [earnings, setEarnings] = useState<{ summary: { pendingCents: number; paidCents: number; count: number }; commissions: CommissionRow[] } | null>(null);
  const [sales, setSales] = useState<{ summary: { pendingCents: number; count: number }; commissions: CommissionRow[] } | null>(null);
  const [products, setProducts] = useState<AffiliateProduct[]>([]);

  const load = useCallback(async () => {
    try {
      const [earnRes, salesRes, productsRes] = await Promise.all([
        authedRequest<{ summary: { pendingCents: number; paidCents: number; count: number }; commissions: CommissionRow[] }>('/api/affiliates/earnings'),
        authedRequest<{ summary: { pendingCents: number; count: number }; commissions: CommissionRow[] }>('/api/affiliates/sales'),
        authedRequest<{ username: string; products: AffiliateProduct[] }>('/api/affiliates/products'),
      ]);
      setEarnings(earnRes);
      setSales(salesRes);
      setUsername(productsRes.username);
      setProducts(productsRes.products);
    } finally {
      setLoaded(true);
    }
  }, [authedRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await authedRequest(`/api/affiliates/commissions/${id}/mark-paid`, { method: 'POST' });
      await load();
    } finally {
      setBusyId('');
    }
  }

  function copyLink(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['sales', 'Affiliate sales'],
            ['earnings', 'Your earnings'],
            ['links', 'Share links'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              tab === key ? 'bg-brand-600 text-white' : 'bg-white text-neutral-600 ring-1 ring-line hover:bg-surface-subtle',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      ) : tab === 'sales' ? (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <h2 className="text-lg font-bold text-[#1a1c3a]">Sales via affiliates</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Orders attributed to <code className="text-xs">?aff=</code> links on your products. Mark commissions paid after you send payout.
          </p>
          <div className="mt-4 flex gap-6 text-sm">
            <span>
              Pending payouts{' '}
              <strong className="text-[#1a1c3a]">{fmtMoney(sales?.summary.pendingCents ?? 0)}</strong>
            </span>
            <span>
              Total sales <strong className="text-[#1a1c3a]">{sales?.summary.count ?? 0}</strong>
            </span>
          </div>
          {(sales?.commissions.length ?? 0) === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-500">No affiliate-attributed sales yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-line/70">
              {sales!.commissions.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                  <div>
                    <div className="font-semibold text-[#1a1c3a]">{c.productTitle}</div>
                    <div className="mt-0.5 text-neutral-500">
                      @{c.affiliateRef} · {c.buyerEmail} · {fmtMoney(c.grossCents, c.currency)} sale
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">
                      {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600">{fmtMoney(c.commissionCents, c.currency)}</span>
                    <Badge tone={c.status === 'paid' ? 'success' : 'warn'}>{c.status}</Badge>
                    {c.status === 'pending' && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => markPaid(c.id)}
                        className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {busyId === c.id ? 'Saving…' : 'Mark paid'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === 'earnings' ? (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <h2 className="text-lg font-bold text-[#1a1c3a]">Commissions you earned</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Sales you referred using <code className="text-xs">?aff={username || 'your_username'}</code> on other creators&apos; products.
          </p>
          <div className="mt-4 flex gap-6 text-sm">
            <span>
              Pending <strong className="text-[#1a1c3a]">{fmtMoney(earnings?.summary.pendingCents ?? 0)}</strong>
            </span>
            <span>
              Paid <strong className="text-emerald-600">{fmtMoney(earnings?.summary.paidCents ?? 0)}</strong>
            </span>
          </div>
          {(earnings?.commissions.length ?? 0) === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-500">
              No commissions yet. Share products with your affiliate link to start earning.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-line/70">
              {earnings!.commissions.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                  <div>
                    <div className="font-semibold text-[#1a1c3a]">{c.productTitle}</div>
                    <div className="mt-0.5 text-neutral-500">{c.commissionPercent}% · {c.buyerEmail}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600">{fmtMoney(c.commissionCents, c.currency)}</span>
                    <Badge tone={c.status === 'paid' ? 'success' : 'warn'}>{c.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <h2 className="text-lg font-bold text-[#1a1c3a]">Your affiliate share links</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Products with affiliate sharing enabled. Replace <code className="text-xs">YOUR_USERNAME</code> with your store handle
            {username ? ` (${username})` : ''}.
          </p>
          {products.length === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-500">
              Enable affiliate sharing on a published product to generate links here.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {products.map((p) => {
                const link = username ? `${origin}/${username}/product/${p.slug}?aff=PARTNER_USERNAME` : '';
                return (
                  <li key={p.id} className="rounded-xl border border-line/70 p-4">
                    <div className="font-semibold text-[#1a1c3a]">{p.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">{p.commissionPercent}% commission</div>
                    {link ? (
                      <div className="mt-3 flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-subtle px-3 py-2 text-xs text-brand-600">
                          {link}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyLink(link)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          {copied === link ? <><IconCheck size={14} /> Copied</> : <><IconCopy size={14} /> Copy</>}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-500">Set a store username in Settings to build links.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

export default function AffiliatesPage() {
  return (
    <DashboardShell title="Affiliates" maxWidth="max-w-[960px]">
      <AffiliatesView />
    </DashboardShell>
  );
}
