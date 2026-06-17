'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { IconClock, IconSmile, IconMail, IconSend } from '@/components/icons';
import { getEnabledFeatures, setFeatureEnabled, NAVPREFS_EVENT } from '@/lib/nav-prefs';
import { cn } from '@/lib/cn';

const FEATURES = [
  { key: 'appointments', label: 'Appointments', href: '/dashboard/bookings', icon: IconClock, blurb: 'I want to keep track of my meetings!' },
  { key: 'referrals', label: 'Referrals', href: '/dashboard/referrals', icon: IconSmile, blurb: 'I want to make passive income on Stan!' },
  { key: 'emails', label: 'Email Flows', href: '/dashboard/emails', icon: IconMail, blurb: 'I want to send automatic emails!' },
  { key: 'autodm', label: 'AutoDM', href: '/dashboard/autodm', icon: IconSend, blurb: 'I want to send automatic IG replies!' },
];

function MoreView() {
  const [enabled, setEnabled] = useState<Set<string>>(() => getEnabledFeatures());
  useEffect(() => {
    const sync = () => setEnabled(getEnabledFeatures());
    sync();
    window.addEventListener(NAVPREFS_EVENT, sync);
    return () => window.removeEventListener(NAVPREFS_EVENT, sync);
  }, []);

  function toggle(e: React.MouseEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    setFeatureEnabled(key, !enabled.has(key));
    setEnabled(getEnabledFeatures());
  }

  return (
    <>
      {/* Direct-deposit reminder */}
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <Link href="/dashboard/settings?tab=payments" className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</Link>{' '}
        to start selling
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const on = enabled.has(f.key);
          return (
            <Link
              key={f.key}
              href={f.href}
              className="group flex items-center gap-5 rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)] transition hover:shadow-[0_8px_24px_-10px_rgba(15,15,25,0.18)]"
            >
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-50 text-[#1a1c3a] transition group-hover:bg-brand-100">
                <Icon size={28} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-lg font-bold text-[#1a1c3a]">
                  {f.label} <span aria-hidden>📌</span>
                </div>
                <p className="mt-0.5 text-sm text-neutral-400">{f.blurb}</p>
              </div>
              <button
                type="button"
                onClick={(e) => toggle(e, f.key)}
                aria-label={`${on ? 'Hide' : 'Show'} ${f.label} in sidebar`}
                className={cn('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand-600' : 'bg-neutral-300')}
              >
                <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', on ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function MorePage() {
  return (
    <DashboardShell title="More Options" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <MoreView />
    </DashboardShell>
  );
}
