'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton } from '@/components/ui';
import { IconCopy, IconCheck, IconPlay } from '@/components/icons';

interface Referral {
  code: string;
  commissionRate: number;
  clicks: number;
  signups: number;
  earningsCents: number;
  referredCount: number;
}
interface ReferredCreator { email: string; signedUpAt: string; code: string; }

const PLAN_MONTHLY = 29; // pro monthly reference price for the calculator
const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------ */
/* Phone mockups for "3 easy ways to earn"                             */
/* ------------------------------------------------------------------ */

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[210px] overflow-hidden rounded-[2.2rem] border-[7px] border-[#111] bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.4)]">
      <div className="h-[420px] overflow-hidden">{children}</div>
    </div>
  );
}

function PhoneStore() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#dcecff] to-white px-4 pt-7 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-brand-gradient" />
      <div className="mt-2 text-sm font-bold text-[#1a1c3a]">Alexandra Silva</div>
      <div className="mt-1 text-[10px] leading-tight text-neutral-500">Helping you succeed while keeping life balanced and happy</div>
      <div className="mt-2 flex justify-center gap-2 text-[10px] text-neutral-400">
        {['▶', '♪', '𝕏', 'in', '◎'].map((s, i) => <span key={i}>{s}</span>)}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl bg-[#fff3b0] p-2 text-left">
        <div className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[9px] font-bold text-white">$</span>
          <span className="text-[10px] font-bold text-[#1a1c3a]">2 weeks free on me ✊</span>
        </div>
        <div className="mt-1.5 rounded-md bg-[#ff2d8e] py-1.5 text-center text-[10px] font-bold text-white">Build your Stan Store</div>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-white px-2 py-2 text-left">
        <span className="flex items-center gap-1.5"><span className="h-5 w-5 rounded bg-brand-100" /><span className="text-[10px] font-semibold text-[#1a1c3a]">1:1 Coaching Session</span></span>
        <span className="text-[10px] font-bold text-[#1a1c3a]">$49</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-white px-2 py-2 text-left">
        <span className="flex items-center gap-1.5"><span className="h-5 w-5 rounded bg-emerald-100" /><span className="text-[10px] font-semibold text-[#1a1c3a]">Wellness Course</span></span>
        <span className="text-[10px] font-bold text-[#1a1c3a]">$75</span>
      </div>
    </div>
  );
}

function PhoneInstagram() {
  return (
    <div className="flex h-full flex-col bg-white px-3 pt-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#1a1c3a]">
        <span>‹</span><span>alexandra_silva</span><span>⋯</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-brand-gradient" />
        <div className="flex flex-1 justify-around text-center">
          {[['33', 'posts'], ['286', 'followers'], ['301', 'following']].map(([n, l]) => (
            <div key={l}><div className="text-xs font-bold text-[#1a1c3a]">{n}</div><div className="text-[9px] text-neutral-500">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="mt-2 text-[10px] leading-tight text-[#1a1c3a]">
        <div className="font-bold">Alexandra Silva</div>
        Helping you succeed while keeping life balanced and happy
        <div className="mt-1 inline-block rounded bg-[#fff3b0] px-1 text-brand-600">🔗 stan.store/alexandra_silva</div>
      </div>
      <div className="mt-2 flex gap-1.5">
        <div className="flex-1 rounded-md bg-[#3897f0] py-1 text-center text-[10px] font-bold text-white">Follow</div>
        <div className="flex-1 rounded-md bg-neutral-100 py-1 text-center text-[10px] font-bold text-[#1a1c3a]">Message</div>
      </div>
      <div className="mt-2 grid flex-1 grid-cols-3 gap-0.5">
        {['#f3a8c8', '#fcd17a', '#9cc8ff', '#fbb38a', '#bdd6ff', '#9fe0a8', '#fcd3e6', '#add0ff', '#fde0a8'].map((c, i) => (
          <div key={i} style={{ background: c }} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}

function PhoneEmail() {
  return (
    <div className="flex h-full flex-col bg-white px-3 pt-3 text-[#1a1c3a]">
      <div className="flex items-center justify-between text-neutral-400"><span className="text-[11px]">‹</span><span className="text-[10px]">🗑 ✉ ⋯</span></div>
      <div className="mt-2 text-[11px] font-bold">Your Freebie Awaits <span className="rounded bg-neutral-100 px-1 text-[8px] font-medium text-neutral-500">Inbox</span></div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-brand-gradient" />
        <div className="flex-1"><div className="text-[10px] font-bold">Alexandra <span className="font-normal text-neutral-400">4:20 PM</span></div><div className="text-[9px] text-neutral-400">to me ▾</div></div>
      </div>
      <div className="mt-2 space-y-1 text-[9px] leading-snug text-neutral-600">
        <p>Hi Chloe,</p>
        <p>Thanks for downloading my freebie!</p>
        <p>This guide offers insights into my Thrive Wellness Course. Please ensure it aligns with your goals before committing.</p>
      </div>
      <div className="mt-2 rounded-md bg-[#fff3b0] p-2 text-[9px] leading-snug">
        Start selling your digital products on Stan 2 weeks are on me! ✊
        <div className="mt-0.5 font-bold text-brand-600 underline">Get Started Now</div>
      </div>
      <div className="mt-auto flex gap-2 border-t border-line pt-2 text-[9px] font-semibold text-neutral-500">
        <span className="rounded-full border border-line px-3 py-0.5">↩ Reply</span>
        <span className="rounded-full border border-line px-3 py-0.5">↪ Forward</span>
      </div>
    </div>
  );
}

const WAYS = [
  { n: 1, title: 'Add to Your Store', body: 'Add your referral code in a click with our built-in tool.', phone: <PhoneStore /> },
  { n: 2, title: 'Mention Stan', body: "Share the experience you've had on Stan with your audience!", phone: <PhoneInstagram /> },
  { n: 3, title: 'Add to Your Email Signature', body: 'Add your code to your email signature for an always-on source.', phone: <PhoneEmail /> },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ReferralsView() {
  const { authedRequest } = useAuth();
  const [ref, setRef] = useState<Referral | null>(null);
  const [referred, setReferred] = useState<ReferredCreator[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [perMonth, setPerMonth] = useState(2);

  const load = useCallback(async () => {
    try {
      const [res, referredRes] = await Promise.all([
        authedRequest<{ referral: Referral | null }>('/api/referrals'),
        authedRequest<{ referred: ReferredCreator[] }>('/api/referrals/referred'),
      ]);
      setRef(res.referral);
      setReferred(referredRes.referred);
    } finally { setLoaded(true); }
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function createCode() {
    setBusy(true);
    try {
      const res = await authedRequest<{ referral: Referral }>('/api/referrals', { method: 'POST' });
      setRef(res.referral);
    } finally { setBusy(false); }
  }
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
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  const rate = ref?.commissionRate ?? 0.2;
  const perCreator = PLAN_MONTHLY * rate; // $/creator/mo recurring
  const after1 = perMonth * perCreator;
  const after12 = perMonth * 12 * perCreator;
  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => (i + 1) / 12), []);

  return (
    <>
      {/* Direct-deposit reminder */}
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <Link href="/dashboard/settings?tab=payments" className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</Link>{' '}
        to start selling
      </div>

      {/* Hero */}
      <div className="mt-5 grid items-center gap-10 rounded-3xl bg-white p-10 shadow-[0_1px_3px_rgba(15,15,25,0.05)] lg:grid-cols-[1fr_minmax(0,440px)]">
        <div>
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight text-[#1a1c3a]">
            Earn {Math.round(rate * 100)}% lifetime commission for each referral. No really.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-500">
            Hear from Lauren why referring Stan to your followers is a win-win for everyone. For you, and for your audience.
          </p>
        </div>
        <button className="group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-[#2a211c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=900&q=70"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-5 right-6 text-right leading-none text-white drop-shadow-md">
            <div className="font-serif text-xl italic">The secret about</div>
            <div className="font-serif text-[42px] font-bold leading-none">referrals.</div>
            <div className="ml-auto mt-1.5 h-1.5 w-32 rounded-full bg-brand-500" />
          </div>
          <span className="relative grid h-[68px] w-[68px] place-items-center rounded-full bg-white/95 text-brand-600 shadow-xl transition group-hover:scale-105">
            <IconPlay size={28} />
          </span>
        </button>
      </div>

      {/* Earnings + share */}
      <div className="mt-5 rounded-3xl bg-white p-10 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Left: share (vertically centered) */}
          <div className="flex flex-col justify-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#1a1c3a]">Share your referral link</h2>
            {!loaded ? (
              <Skeleton className="mt-6 h-12 w-64" />
            ) : !ref ? (
              <button onClick={createCode} disabled={busy} className="mt-6 w-fit rounded-full bg-brand-600 px-8 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'Creating…' : 'Create Your Referral Code'}
              </button>
            ) : (
              <div className="mt-6 max-w-md">
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-full border border-line bg-surface-subtle px-4 py-3 text-sm">
                    <span className="truncate text-neutral-600">{link}</span>
                  </div>
                  <button onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700">
                    {copied ? <><IconCheck size={16} /> Copied</> : <><IconCopy size={16} /> Copy</>}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-sm">
                  <span className="text-neutral-500">Clicks <span className="font-bold text-[#1a1c3a]">{ref.clicks}</span></span>
                  <span className="text-neutral-500">Signups <span className="font-bold text-[#1a1c3a]">{ref.signups}</span></span>
                  <span className="text-neutral-500">Earned <span className="font-bold text-emerald-600">{fmtMoney(ref.earningsCents)}</span></span>
                  <button onClick={regenerate} disabled={busy} className="font-bold text-brand-600 hover:text-brand-700">New code</button>
                </div>
              </div>
            )}
          </div>

          {/* Right: projections + chart + slider */}
          <div>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-bold text-brand-600">{fmtUsd(after1)}<span className="text-sm font-medium text-neutral-400">/mo</span></div>
                <div className="text-xs text-neutral-500">after 1 month</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-brand-600">{fmtUsd(after12)}<span className="text-sm font-medium text-neutral-400">/mo</span></div>
                <div className="text-xs text-neutral-500">after 12 months</div>
              </div>
            </div>
            <div className="mt-5 flex h-[200px] items-end gap-1.5">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-brand-500 transition-all" style={{ height: `${h * 100}%`, opacity: 0.3 + (i / 11) * 0.7 }} />
              ))}
            </div>
            <div className="mt-5">
              <input type="range" min={1} max={10} value={perMonth} onChange={(e) => setPerMonth(Number(e.target.value))} className="w-full accent-brand-600" />
              <div className="mt-1.5 text-center text-sm font-bold text-brand-600">{perMonth} creator{perMonth > 1 ? 's' : ''}/mo</div>
            </div>
          </div>
        </div>
      </div>

      {ref && referred.length > 0 && (
        <div className="mt-5 rounded-3xl bg-white p-8 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
          <h2 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Your referrals</h2>
          <p className="mt-1 text-sm text-neutral-500">Creators who signed up with your link. You earn {Math.round(rate * 100)}% on their subscription payments.</p>
          <ul className="mt-4 divide-y divide-line/70">
            {referred.map((r) => (
              <li key={r.email} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-[#1a1c3a]">{r.email}</span>
                <span className="shrink-0 text-neutral-400">
                  Joined {new Date(r.signedUpAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3 ways to earn */}
      <div className="mt-5 rounded-3xl bg-white p-8 shadow-[0_1px_3px_rgba(15,15,25,0.05)]">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a1c3a]">3 easy ways to earn</h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {WAYS.map((w) => (
            <div key={w.n} className="text-center">
              <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-surface-subtle text-sm font-bold text-[#1a1c3a]">{w.n}</div>
              <h3 className="mt-4 text-lg font-bold text-[#1a1c3a]">{w.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">{w.body}</p>
              <div className="mt-6"><Phone>{w.phone}</Phone></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function ReferralsPage() {
  return (
    <DashboardShell title="Referrals" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <ReferralsView />
    </DashboardShell>
  );
}
