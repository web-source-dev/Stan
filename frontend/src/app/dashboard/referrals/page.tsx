'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, Card, Skeleton, Stat } from '@/components/ui';
import { IconSmile, IconCopy, IconCheck, IconTrending } from '@/components/icons';
import { formatPrice } from '@/lib/types';

interface Referral {
  code: string;
  commissionRate: number;
  clicks: number;
  signups: number;
  earningsCents: number;
  referredCount: number;
}

const PLAN_MONTHLY = 29; // $/mo reference price for the calculator

function ReferralsView() {
  const { authedRequest } = useAuth();
  const [ref, setRef] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  const [perMonth, setPerMonth] = useState(2);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await authedRequest<{ referral: Referral }>('/api/referrals');
    setRef(res.referral);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function regenerate() {
    setBusy(true);
    try {
      const res = await authedRequest<{ referral: Referral }>('/api/referrals/regenerate', { method: 'POST' });
      setRef(res.referral);
    } finally { setBusy(false); }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = ref ? `${origin}/signup?ref=${ref.code}` : '';

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const rate = ref?.commissionRate ?? 0.2;
  const perCreator = PLAN_MONTHLY * rate; // $/creator/mo recurring
  const after1 = perMonth * perCreator;
  const after12 = perMonth * 12 * perCreator;

  return (
    <DashboardShell title="Referrals" subtitle="Earn lifetime commission for every creator you refer." maxWidth="max-w-5xl">
      {/* Hero */}
      <Card className="overflow-hidden bg-brand-gradient text-white">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            Earn {Math.round(rate * 100)}% lifetime commission for each referral. No really.
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Refer Stan to your followers — it&apos;s a win-win for everyone. For you, and for your audience.
          </p>
        </div>
      </Card>

      {ref === null ? (
        <Skeleton className="mt-6 h-40 w-full" />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Clicks" value={ref.clicks} />
            <Stat label="Signups" value={ref.signups} />
            <Stat label="Referred" value={ref.referredCount} />
            <Stat label="Earnings" value={formatPrice(ref.earningsCents)} icon={<IconTrending size={18} />} />
          </div>

          {/* Share link */}
          <Card className="mt-6">
            <h3 className="font-semibold">Share your referral link</h3>
            <p className="mt-0.5 text-sm text-neutral-500">Anyone who signs up through this link is tied to you for life.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-line bg-surface-subtle px-4 py-2.5 text-sm">
                <span className="truncate text-neutral-600">{link}</span>
              </div>
              <Button variant="secondary" onClick={copy}>
                {copied ? <><IconCheck size={16} className="text-success-600" /> Copied</> : <><IconCopy size={16} /> Copy link</>}
              </Button>
              <Button variant="ghost" onClick={regenerate} loading={busy}>New code</Button>
            </div>
          </Card>

          {/* Earnings calculator */}
          <Card className="mt-6">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><IconSmile size={18} /></span>
              <h3 className="font-semibold">Estimate your earnings</h3>
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <div>
                <div className="text-2xl font-bold text-brand-700">{formatPrice(Math.round(after1 * 100))}<span className="text-sm font-medium text-neutral-400">/mo</span></div>
                <div className="text-xs text-neutral-500">after 1 month</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-brand-700">{formatPrice(Math.round(after12 * 100))}<span className="text-sm font-medium text-neutral-400">/mo</span></div>
                <div className="text-xs text-neutral-500">after 12 months</div>
              </div>
            </div>
            <input
              type="range" min={1} max={10} value={perMonth}
              onChange={(e) => setPerMonth(Number(e.target.value))}
              className="mt-5 w-full accent-brand-600"
            />
            <div className="mt-1 text-center text-sm font-medium text-neutral-600">{perMonth} creator{perMonth > 1 ? 's' : ''}/mo</div>
          </Card>
        </>
      )}
    </DashboardShell>
  );
}

export default function ReferralsPage() {
  return <ReferralsView />;
}
