'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, ApiException } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DashboardShell } from '@/components/DashboardShell';
import { ConnectCard } from '@/components/ConnectCard';
import { Button, Card, Alert, Badge, Stat, SectionHeading } from '@/components/ui';
import {
  IconBox, IconUsers, IconExternal, IconCopy, IconCheck,
  IconChart, IconBag, IconArrowRight, IconBolt, IconStore, IconSparkles, IconCheckCircle,
} from '@/components/icons';
import { formatPrice, type CreatorProfile } from '@/lib/types';

function VerifyBanner() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;

  async function resend() {
    setBusy(true);
    await apiRequest('/api/auth/resend-verification', { method: 'POST' }).catch(() => {});
    setSent(true);
    setBusy(false);
  }

  return (
    <Alert kind="warn" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <IconBolt size={16} />
          {sent ? 'Verification email sent — check your inbox.' : 'Verify your email to publish your storefront.'}
        </span>
        {!sent && (
          <button onClick={resend} disabled={busy} className="font-semibold underline underline-offset-2">
            {busy ? 'Sending…' : 'Resend email'}
          </button>
        )}
      </div>
    </Alert>
  );
}

function PublishCard({ profile, onChange }: { profile: CreatorProfile; onChange: (p: CreatorProfile) => void }) {
  const { user, authedRequest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const storefrontUrl = `${origin}/${profile.username}`;

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const res = await authedRequest<{ profile: CreatorProfile }>(
        profile.published ? '/api/creator/unpublish' : '/api/creator/publish',
        { method: 'POST' },
      );
      onChange(res.profile);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(storefrontUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">Storefront</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {profile.published ? 'Your storefront is live.' : 'Your storefront is in draft mode.'}
          </p>
        </div>
        <Badge tone={profile.published ? 'success' : 'neutral'} dot>
          {profile.published ? 'Published' : 'Draft'}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-1 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm">
        <span className="truncate text-neutral-600">/{profile.username}</span>
        <button onClick={copy} title="Copy link" className="ml-auto rounded-md p-1.5 text-neutral-400 hover:bg-surface-muted hover:text-ink">
          {copied ? <IconCheck size={15} className="text-success-600" /> : <IconCopy size={15} />}
        </button>
        <Link href={`/${profile.username}`} target="_blank" title="Open" className="rounded-md p-1.5 text-neutral-400 hover:bg-surface-muted hover:text-ink">
          <IconExternal size={15} />
        </Link>
      </div>

      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
      {!user?.emailVerified && !profile.published && (
        <p className="mt-3 text-xs text-neutral-500">Verify your email to publish.</p>
      )}

      <div className="mt-4">
        <Button variant={profile.published ? 'secondary' : 'primary'} onClick={toggle} loading={busy} fullWidth>
          {profile.published ? 'Unpublish storefront' : 'Publish storefront'}
        </Button>
      </div>
    </Card>
  );
}

function TaskCard({
  href, icon, title, body, done, soon,
}: {
  href: string; icon: ReactNode; title: string; body: string; done?: boolean; soon?: boolean;
}) {
  const inner = (
    <Card hover={!soon} className={cn('h-full', soon && 'opacity-70')}>
      <div className="flex items-start gap-4">
        <span className={cn(
          'grid h-12 w-12 shrink-0 place-items-center rounded-2xl',
          done ? 'bg-success-50 text-success-600' : 'bg-brand-50 text-brand-600',
        )}>
          {done ? <IconCheckCircle size={24} /> : icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold">
            {title}
            {soon
              ? <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-neutral-400">Soon</span>
              : <IconArrowRight size={15} className="text-neutral-300" />}
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">{body}</p>
          {done && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success-600"><IconCheck size={13} /> Done</span>}
        </div>
      </div>
    </Card>
  );
  if (soon) return inner;
  return <Link href={href}>{inner}</Link>;
}

interface Insights { views: number; checkoutStarts: number; orders: number; visitToCheckoutRate: number; checkoutToOrderRate: number; }

function Dashboard() {
  const { authedRequest } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [summary, setSummary] = useState<{ revenueCents: number; orders: number; publishedProducts: number } | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile');
    if (res.profile) setProfile(res.profile);
    authedRequest<{ revenueCents: number; orders: number; publishedProducts: number }>('/api/orders/summary').then(setSummary).catch(() => {});
    authedRequest<Insights>('/api/events/insights/summary').then(setInsights).catch(() => {});
    authedRequest<{ total: number }>('/api/leads/manage/stats').then((s) => setLeadCount(s.total)).catch(() => {});
  }, [authedRequest]);

  useEffect(() => { void load(); }, [load]);

  if (!profile) return null;

  const firstName = (profile.displayName || 'there').split(' ')[0];
  const themeDone = profile.published;
  const productDone = (summary?.publishedProducts ?? 0) > 0;

  return (
    <>
      <VerifyBanner />

      {/* Welcome hero */}
      <div className="mb-7">
        <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-brand-700 sm:text-[2rem]">
          Welcome, {firstName} <span className="align-middle">👋</span>
          <br />
          Let&apos;s get you ready to sell.
        </h2>
      </div>

      {/* Get-ready task cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TaskCard
          href="/dashboard/storefront"
          icon={<IconStore size={24} />}
          title="Choose store theme"
          body="Customize your store design and bring your brand to life."
          done={themeDone}
        />
        <TaskCard
          href="/dashboard/products"
          icon={<IconBox size={24} />}
          title="Add a product"
          body="Go from idea to product offer in minutes."
          done={productDone}
        />
        <TaskCard
          href="#"
          icon={<IconSparkles size={24} />}
          title="Ask Stanley"
          body="Your very own AI Creator coach."
          soon
        />
      </div>

      {/* At-a-glance */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue · 30d" value={summary ? formatPrice(summary.revenueCents) : '—'} icon={<IconChart size={18} />} />
        <Stat label="Orders · 30d" value={summary ? String(summary.orders) : '—'} icon={<IconBag size={18} />} />
        <Stat label="Live products" value={summary ? String(summary.publishedProducts) : '—'} icon={<IconBox size={18} />} />
        <Stat label="Audience" value={leadCount === null ? '—' : String(leadCount)} icon={<IconUsers size={18} />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <PublishCard profile={profile} onChange={setProfile} />
        <ConnectCard />
      </div>

      {insights && insights.views > 0 && (
        <Card className="mt-6">
          <SectionHeading title="Conversion · 30d" subtitle="From storefront view to completed order." />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Storefront views', value: insights.views, rate: null as string | null },
              { label: 'Checkouts started', value: insights.checkoutStarts, rate: `${insights.visitToCheckoutRate}%` },
              { label: 'Orders', value: insights.orders, rate: `${insights.checkoutToOrderRate}%` },
            ].map((step, i) => (
              <div key={step.label} className="relative rounded-xl border border-line bg-surface-subtle p-4">
                <div className="text-2xl font-bold tracking-tight">{step.value}</div>
                <div className="mt-0.5 text-sm text-neutral-600">{step.label}</div>
                {step.rate && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {step.rate} conversion
                  </div>
                )}
                {i < 2 && (
                  <IconArrowRight size={18} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-neutral-300 sm:block" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

    </>
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell title="Home">
      <Dashboard />
    </DashboardShell>
  );
}
