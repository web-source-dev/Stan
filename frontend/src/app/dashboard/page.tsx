'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { IconArrowRight } from '@/components/icons';
import { type CreatorProfile } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Thumbnails for the action cards                                     */
/* ------------------------------------------------------------------ */

function ThumbMarket() {
  return (
    <div className="relative h-[88px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#243018] to-[#0b1206]">
      <div className="absolute left-2.5 top-3 text-[10px] font-extrabold leading-tight text-white">Eat Well,<br />Spend Less</div>
      <div className="absolute left-2.5 top-[34px] text-[6px] text-white/60">on my book</div>
      <span className="absolute right-2 top-2 text-[11px]">❤️</span>
      <span className="absolute bottom-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] text-brand-600">➤</span>
    </div>
  );
}

function ThumbProduct() {
  return (
    <div className="relative h-[88px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-[#cde0f2] p-2.5">
      <div className="rounded-md bg-white px-2 py-1 shadow-sm">
        <div className="text-[7px] font-bold leading-tight text-[#1a1c3a]">The Creator Code</div>
        <div className="text-[6px] text-neutral-400">RTN</div>
      </div>
      <div className="mt-1 rounded-md bg-brand-600 py-1 text-center text-[7px] font-bold text-white">Buy Now</div>
      <div className="mt-1 rounded-md bg-white py-1 text-center text-[7px] font-semibold text-[#1a1c3a] shadow-sm">Schedule 1:1</div>
    </div>
  );
}

function ThumbStanley() {
  return (
    <div className="relative h-[88px] w-[104px] shrink-0">
      <span className="absolute right-4 top-0 text-sm font-extrabold text-brand-500">$</span>
      <span className="absolute left-3 top-7 h-3 w-3 rotate-12 rounded-[3px] bg-brand-200" />
      <span className="absolute right-3 bottom-3 h-3.5 w-3.5 -rotate-12 rounded-[3px] bg-brand-300" />
      <div className="absolute bottom-1 left-1/2 grid h-[62px] w-[62px] -translate-x-1/2 place-items-center rounded-[31px_31px_31px_8px] bg-brand-600">
        <svg width="32" height="32" viewBox="0 0 44 44" fill="none" aria-hidden>
          <ellipse cx="16.5" cy="19" rx="2.3" ry="4" fill="#fff" />
          <ellipse cx="27.5" cy="19" rx="2.3" ry="4" fill="#fff" />
          <path d="M14 27c1.8 3 5 3.4 8 3.4s6.2-.4 8-3.4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}

function HomeCard({ href, title, body, thumb }: { href?: string; title: string; body: string; thumb: ReactNode }) {
  const inner = (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.05)] transition hover:shadow-[0_10px_28px_-12px_rgba(15,15,25,0.2)]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[17px] font-bold text-[#1a1c3a]">
          {title} <IconArrowRight size={16} className="text-[#1a1c3a]" />
        </div>
        <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-neutral-500">{body}</p>
      </div>
      {thumb}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function AlertIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b59500" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <circle cx="12" cy="16.5" r="0.6" fill="#b59500" stroke="none" />
    </svg>
  );
}

function Dashboard() {
  const { authedRequest } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);

  const load = useCallback(async () => {
    const res = await authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile');
    if (res.profile) setProfile(res.profile);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  const firstName = (profile?.displayName || 'there').split(' ')[0];

  return (
    <>
      {/* Direct-deposit reminder */}
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <Link href="/dashboard/settings?tab=payments" className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</Link>{' '}
        to start selling
      </div>

      {/* Set-up alert */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ece08f] bg-[#fcf6bd] px-6 py-4">
        <div className="flex items-center gap-3">
          <AlertIcon />
          <span className="text-[15px] font-semibold text-[#1a1c3a]">To start selling, set up direct deposit</span>
        </div>
        <Link href="/dashboard/settings?tab=payments" className="text-[15px] font-bold text-[#1a1c3a] transition hover:text-brand-700">Set Up Direct Deposit</Link>
      </div>

      {/* Welcome + action cards */}
      <div className="mt-8 max-w-[460px]">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-brand-600">
          Welcome, {firstName} <span className="align-middle">👋</span>
          <br />
          Let&apos;s get you ready to sell.
        </h1>

        <div className="mt-6 space-y-4">
          <HomeCard
            href="/dashboard/storefront"
            title="Market your products"
            body="Make a post to highlight your offer on socials"
            thumb={<ThumbMarket />}
          />
          <HomeCard
            href="/dashboard/products/new"
            title="Add a product"
            body="Go from idea to product offer in minutes"
            thumb={<ThumbProduct />}
          />
          <HomeCard
            title="Ask Stanley"
            body="Your very own AI Creator coach"
            thumb={<ThumbStanley />}
          />
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell title="Home" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <Dashboard />
    </DashboardShell>
  );
}
