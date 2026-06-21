'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePlan, type PlanFeatures } from '@/lib/use-plan';
import { IconLock, IconCheck, IconArrowRight } from '@/components/icons';
import { Skeleton } from '@/components/ui';

/** Boolean (on/off) plan features — i.e. everything except the numeric limits. */
type GateableFeature = Exclude<keyof PlanFeatures, 'maxProducts'>;

const TIER_INFO: Record<string, { price: string; blurb: string; benefits: string[] }> = {
  Pro: {
    price: '$29',
    blurb: 'Everything you need to grow your store.',
    benefits: [
      'Unlimited products',
      'Courses & digital downloads',
      'Bookings & appointments',
      'Email broadcasts & automated flows',
      'Landing pages',
      'Full analytics & conversion funnel',
      'Remove “Powered by Stan” branding',
    ],
  },
  Premium: {
    price: '$49',
    blurb: 'Everything in Pro, plus automation & AI.',
    benefits: [
      'Everything in Pro',
      'AutoDM for Instagram',
      'Stanley AI creator assistant',
      'Affiliate sharing & commissions',
    ],
  },
};

function UpgradeScreen({ name, tier }: { name: string; tier: string }) {
  const info = TIER_INFO[tier] ?? TIER_INFO.Pro;
  return (
    <div className="mx-auto max-w-lg py-10 sm:py-14">
      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_70px_-28px_rgba(15,15,25,0.3)]">
        {/* Gradient hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-8 py-10 text-center text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(circle at 30% 15%, rgba(255,255,255,0.5), transparent 55%)' }}
          />
          <div className="relative">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <IconLock size={26} />
            </div>
            <div className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
              {tier} plan
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Unlock {name}</h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/85">{info.blurb}</p>
          </div>
        </div>

        {/* Benefits + CTA */}
        <div className="px-8 py-7">
          <div className="text-xs font-bold uppercase tracking-wide text-neutral-400">The {tier} plan includes</div>
          <ul className="mt-3.5 grid gap-2.5">
            {info.benefits.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[15px] text-[#1a1c3a]">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-100 text-success-700">
                  <IconCheck size={12} />
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div className="leading-none">
              <span className="text-3xl font-bold tracking-tight text-[#1a1c3a]">{info.price}</span>
              <span className="text-sm font-medium text-neutral-400">/month</span>
            </div>
            <Link
              href="/dashboard/settings?tab=billing"
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Upgrade to {tier} <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/dashboard/settings?tab=billing" className="text-sm font-medium text-neutral-500 transition hover:text-ink">
          Compare all plans
        </Link>
      </div>
    </div>
  );
}

/**
 * Gate a whole page on a plan feature. Renders a polished upgrade screen (instead
 * of the page content) when the current plan doesn't include `feature` — so a
 * direct URL can't bypass the sidebar lock. The backend enforces the same gate.
 */
export function FeatureGate({
  feature,
  name,
  tier,
  children,
}: {
  feature: GateableFeature;
  name: string;
  tier: string;
  children: ReactNode;
}) {
  const { features, loading } = usePlan();
  if (loading || !features) return <Skeleton className="h-64 w-full" />;
  if (!features[feature]) return <UpgradeScreen name={name} tier={tier} />;
  return <>{children}</>;
}
