'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Modal } from '@/components/Modal';
import { emitPlanChanged } from '@/lib/plan-events';
import { Skeleton } from '@/components/ui';
import {
  IconUsers, IconPlus, IconDollar, IconCard, IconBell, IconLock, IconShield, IconEye,
  IconDownload, IconCheckCircle, IconChevronDown,
} from '@/components/icons';
import { formatPrice, type CreatorProfile } from '@/lib/types';
import { PaymentDetails, type SavedCard } from '@/components/PaymentDetails';
import { cn } from '@/lib/cn';

type TabKey = 'profile' | 'integrations' | 'billing' | 'payments' | 'notifications' | 'security';
const TABS: { value: TabKey; label: string; icon: React.ReactNode }[] = [
  { value: 'profile', label: 'Profile', icon: <IconUsers size={16} /> },
  { value: 'integrations', label: 'Integrations', icon: <IconPlus size={16} /> },
  { value: 'billing', label: 'Billing', icon: <IconDollar size={16} /> },
  { value: 'payments', label: 'Payments', icon: <IconCard size={16} /> },
  { value: 'notifications', label: 'Email Notifications', icon: <IconBell size={16} /> },
  { value: 'security', label: 'Security', icon: <IconShield size={16} /> },
];
const VALID = TABS.map((t) => t.value);

const COUNTRIES = [
  { code: '+1', iso: 'us' }, { code: '+44', iso: 'gb' }, { code: '+92', iso: 'pk' }, { code: '+91', iso: 'in' },
  { code: '+61', iso: 'au' }, { code: '+49', iso: 'de' }, { code: '+33', iso: 'fr' }, { code: '+971', iso: 'ae' },
];
function splitPhone(full?: string): { code: string; number: string } {
  if (!full) return { code: '+1', number: '' };
  const m = full.match(/^(\+\d{1,4})\s*(.*)$/);
  if (m && COUNTRIES.some((c) => c.code === m[1])) return { code: m[1], number: m[2] };
  return { code: '+1', number: full };
}

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

const CARD = 'rounded-3xl bg-white p-7 shadow-[0_1px_3px_rgba(15,15,25,0.05)]';
const INPUT = 'w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500 disabled:bg-surface-muted disabled:text-neutral-500';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-semibold text-[#1a1c3a]">{children}</label>;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} type="button" className={cn('relative h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-brand-600' : 'bg-neutral-300')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

function PrimaryBtn({ children, onClick, disabled, loading, className = '' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className={cn('rounded-full bg-brand-600 px-7 py-3 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none', className)}>
      {loading ? 'Saving…' : children}
    </button>
  );
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'pr-11')} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink">
          <IconEye size={18} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfileTab({ initialProfile }: { initialProfile?: CreatorProfile }) {
  const { user, authedRequest } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(initialProfile ?? null);
  const [name, setName] = useState(initialProfile?.displayName ?? '');
  const [code, setCode] = useState(splitPhone(initialProfile?.phone).code);
  const [phone, setPhone] = useState(splitPhone(initialProfile?.phone).number);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Analytics + Address
  const [analytics, setAnalytics] = useState({ facebookPixelId: '', googleAnalyticsId: '', tiktokPixelId: '', pinterestTag: '', ...initialProfile?.analytics });
  const [addr, setAddr] = useState({ street: '', city: '', state: '', postalCode: '', country: '', ...initialProfile?.address });
  const [aBusy, setABusy] = useState(false); const [aSaved, setASaved] = useState(false);
  const [adBusy, setAdBusy] = useState(false); const [adSaved, setAdSaved] = useState(false);

  useEffect(() => {
    if (initialProfile !== undefined) return;
    authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile').then((r) => {
      if (r.profile) {
        setProfile(r.profile);
        setName(r.profile.displayName);
        const sp = splitPhone(r.profile.phone);
        setCode(sp.code); setPhone(sp.number);
        if (r.profile.analytics) setAnalytics({ facebookPixelId: '', googleAnalyticsId: '', tiktokPixelId: '', pinterestTag: '', ...r.profile.analytics });
        if (r.profile.address) setAddr({ street: '', city: '', state: '', postalCode: '', country: '', ...r.profile.address });
      }
    }).catch(() => {});
  }, [authedRequest, initialProfile]);

  async function saveAnalytics() {
    setABusy(true); setASaved(false);
    try {
      const res = await authedRequest<{ profile: CreatorProfile }>('/api/creator/profile', { method: 'PATCH', body: { analytics } });
      setProfile(res.profile); setASaved(true); setTimeout(() => setASaved(false), 1800);
    } finally { setABusy(false); }
  }
  async function saveAddress() {
    setAdBusy(true); setAdSaved(false);
    try {
      const res = await authedRequest<{ profile: CreatorProfile }>('/api/creator/profile', { method: 'PATCH', body: { address: addr } });
      setProfile(res.profile); setAdSaved(true); setTimeout(() => setAdSaved(false), 1800);
    } finally { setAdBusy(false); }
  }

  const dirty = profile ? (name !== profile.displayName || `${code} ${phone}`.trim() !== (profile.phone ?? '').trim()) : false;

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await authedRequest<{ profile: CreatorProfile }>('/api/creator/profile', {
        method: 'PATCH',
        body: { displayName: name, phone: phone ? `${code} ${phone}`.trim() : '' },
      });
      setProfile(res.profile);
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } finally { setSaving(false); }
  }

  async function changePassword() {
    setPwMsg(null);
    if (next !== confirm) { setPwMsg({ kind: 'err', text: 'New passwords do not match.' }); return; }
    if (next.length < 8) { setPwMsg({ kind: 'err', text: 'New password must be at least 8 characters.' }); return; }
    setPwBusy(true);
    try {
      await authedRequest('/api/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: next } });
      setPwMsg({ kind: 'ok', text: 'Password updated.' });
      setCur(''); setNext(''); setConfirm('');
    } catch (e) {
      setPwMsg({ kind: 'err', text: e instanceof ApiException ? e.message : 'Could not update password' });
    } finally { setPwBusy(false); }
  }

  if (!profile) return <div className={CARD}><Skeleton className="h-64 w-full" /></div>;
  const iso = COUNTRIES.find((c) => c.code === code)?.iso ?? 'us';

  return (
    <div className={CARD}>
      <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">My Profile</h2>
      <div className="mt-5 grid max-w-3xl gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Username</FieldLabel>
          <input className={INPUT} value={profile.username} disabled />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input className={INPUT} value={user?.email ?? ''} disabled />
        </div>
        <div>
          <FieldLabel>Phone Number</FieldLabel>
          <div className="flex gap-2">
            <div className="relative flex items-center gap-2 rounded-xl border border-line-strong bg-white pl-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://flagcdn.com/24x18/${iso}.png`} alt="" width={22} height={16} className="rounded-sm" />
              <div className="relative flex items-center">
                <select value={code} onChange={(e) => setCode(e.target.value)} className="cursor-pointer appearance-none bg-transparent py-3 pr-6 text-[15px] text-ink outline-none">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <IconChevronDown size={15} className="pointer-events-none absolute right-1 text-neutral-400" />
              </div>
            </div>
            <input className={cn(INPUT, 'flex-1')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <PrimaryBtn onClick={save} disabled={!dirty} loading={saving}>Update</PrimaryBtn>
        {saved && <span className="flex items-center gap-1 text-sm font-medium text-success-600"><IconCheckCircle size={15} /> Saved</span>}
      </div>

      <h2 className="mt-10 text-lg font-bold tracking-tight text-[#1a1c3a]">Password</h2>
      <div className="mt-5 max-w-md space-y-4">
        <PwField label="Current Password" value={cur} onChange={setCur} />
        <div className="grid gap-4 sm:grid-cols-2">
          <PwField label="New Password" value={next} onChange={setNext} />
          <PwField label="Confirm Password" value={confirm} onChange={setConfirm} />
        </div>
        {pwMsg && <p className={cn('text-sm font-medium', pwMsg.kind === 'ok' ? 'text-success-600' : 'text-danger-600')}>{pwMsg.text}</p>}
        <PrimaryBtn onClick={changePassword} loading={pwBusy} disabled={!cur || !next || !confirm}>Update</PrimaryBtn>
      </div>

      {/* Analytics */}
      <h2 className="mt-10 text-lg font-bold tracking-tight text-[#1a1c3a]">Analytics</h2>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        Want to include your Facebook/Google Pixel?
        <Link href="/dashboard/settings?tab=billing" className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-100">Upgrade Now</Link>
      </div>
      <div className="mt-5 grid max-w-3xl gap-5 sm:grid-cols-2">
        <div><FieldLabel>Facebook Pixel Id</FieldLabel><input className={INPUT} value={analytics.facebookPixelId} onChange={(e) => setAnalytics({ ...analytics, facebookPixelId: e.target.value })} /></div>
        <div><FieldLabel>Google Analytics Id</FieldLabel><input className={INPUT} value={analytics.googleAnalyticsId} onChange={(e) => setAnalytics({ ...analytics, googleAnalyticsId: e.target.value })} /></div>
        <div><FieldLabel>Tiktok Pixel Id</FieldLabel><input className={INPUT} value={analytics.tiktokPixelId} onChange={(e) => setAnalytics({ ...analytics, tiktokPixelId: e.target.value })} /></div>
        <div><FieldLabel>Pinterest Claim Tag Id</FieldLabel><input className={INPUT} value={analytics.pinterestTag} onChange={(e) => setAnalytics({ ...analytics, pinterestTag: e.target.value })} /></div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <PrimaryBtn onClick={saveAnalytics} loading={aBusy}>Update</PrimaryBtn>
        {aSaved && <span className="flex items-center gap-1 text-sm font-medium text-success-600"><IconCheckCircle size={15} /> Saved</span>}
      </div>

      {/* Address */}
      <h2 className="mt-10 text-lg font-bold tracking-tight text-[#1a1c3a]">Address</h2>
      <div className="mt-5 grid max-w-3xl gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><FieldLabel>Street Address</FieldLabel><input className={INPUT} placeholder="Start typing your address..." value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></div>
        <div><FieldLabel>City</FieldLabel><input className={INPUT} value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></div>
        <div><FieldLabel>State/Province</FieldLabel><input className={INPUT} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} /></div>
        <div><FieldLabel>Postal Code</FieldLabel><input className={INPUT} value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} /></div>
        <div><FieldLabel>Country</FieldLabel><input className={INPUT} value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} /></div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <PrimaryBtn onClick={saveAddress} loading={adBusy}>Update</PrimaryBtn>
        {adSaved && <span className="flex items-center gap-1 text-sm font-medium text-success-600"><IconCheckCircle size={15} /> Saved</span>}
      </div>

      {/* Other */}
      <h2 className="mt-10 text-lg font-bold tracking-tight text-[#1a1c3a]">Other</h2>
      <div className="mt-3 max-w-md">
        <div className="font-bold text-[#1a1c3a]">Stan Store Referral Banner</div>
        <p className="mt-1 text-sm text-neutral-500">Upgrade to Creator Pro to hide the Stan Store Referral Banner.</p>
        <button disabled className="mt-4 cursor-not-allowed rounded-full bg-neutral-200 px-7 py-3 text-[15px] font-bold text-neutral-400">Update</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

/* Brand marks (inline SVG so they match the real logos without asset files). */
function LogoGoogleCalendar() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google Calendar" width={40} height={40} className="h-10 w-10" />
  );
}
function LogoZoom() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10">
      <rect width="24" height="24" rx="6" fill="#2D8CFF" />
      <path d="M6 9.6A1.6 1.6 0 0 1 7.6 8h4.8A1.6 1.6 0 0 1 14 9.6v4.8A1.6 1.6 0 0 1 12.4 16H7.6A1.6 1.6 0 0 1 6 14.4V9.6Z" fill="#fff" />
      <path d="M15 11l2.6-1.7c.4-.3 1 0 1 .5v4.4c0 .5-.6.8-1 .5L15 13v-2Z" fill="#fff" />
    </svg>
  );
}
function LogoZapier() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10">
      <rect width="24" height="24" rx="6" fill="#FF4F00" />
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5.5" x2="12" y2="18.5" />
        <line x1="5.5" y1="12" x2="18.5" y2="12" />
        <line x1="7.4" y1="7.4" x2="16.6" y2="16.6" />
        <line x1="16.6" y1="7.4" x2="7.4" y2="16.6" />
      </g>
    </svg>
  );
}
function LogoInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10">
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" /><stop offset="0.4" stopColor="#FA7E1E" /><stop offset="0.75" stopColor="#D62976" /><stop offset="1" stopColor="#962FBF" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#ig-grad)" />
      <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16.2" cy="7.8" r="1.1" fill="#fff" />
    </svg>
  );
}

/* The purple Stanley mascot for the IG add-on card. */
function StanleyMascot() {
  return (
    <div className="relative h-[110px] w-[120px]">
      <span className="absolute right-2 top-0 text-2xl font-extrabold text-brand-500">$</span>
      <div className="absolute bottom-0 right-3 grid h-[84px] w-[84px] place-items-center rounded-[42px_42px_42px_10px] bg-brand-600">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
          <ellipse cx="16.5" cy="19" rx="2.4" ry="4.4" fill="#fff" />
          <ellipse cx="27.5" cy="19" rx="2.4" ry="4.4" fill="#fff" />
          <path d="M14 27c1.8 3.2 5 3.7 8 3.7s6.2-.5 8-3.7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <div className="absolute bottom-1 left-0"><LogoInstagram /></div>
    </div>
  );
}

const INTEGRATIONS = [
  { provider: 'google_calendar', name: 'Google Calendar', tag: 'Our Built-in Calendar Product', body: "Stop paying for boring calendar scheduling tools and instead use Stan's built-in calendar feature to keep everything under one roof.", logo: <LogoGoogleCalendar /> },
  { provider: 'zoom', name: 'Zoom', tag: 'Meet with Customers on Zoom', body: 'Integrate Zoom with your Stan account to simplify the scheduling process and automatically send Zoom meeting links to customers who book a time on your calendar.', logo: <LogoZoom /> },
  { provider: 'zapier', name: 'Zapier', tag: 'Connect Stan With 3rd Party Tools', body: "Have a favorite tool that you'd like to connect to Stan? Use Zapier to remove the manual work and automate your processes.", logo: <LogoZapier /> },
  { provider: 'instagram', name: 'Instagram', tag: 'Send Automated Replies', body: 'Connect your Instagram account to automatically reply to Instagram messages and comments.', logo: <LogoInstagram /> },
];

function IntegrationsTab() {
  const { authedRequest } = useAuth();
  const [connected, setConnected] = useState<Set<string>>(new Set());

  useEffect(() => {
    authedRequest<{ integrations: { provider: string; connected: boolean }[] }>('/api/integrations')
      .then((r) => setConnected(new Set(r.integrations.filter((i) => i.connected).map((i) => i.provider))))
      .catch(() => {});
  }, [authedRequest]);

  async function connect(provider: string) {
    const res = await authedRequest<{ authorizeUrl: string }>(`/api/integrations/${provider}/connect`, { method: 'POST' });
    window.location.href = res.authorizeUrl;
  }
  async function disconnect(provider: string) {
    await authedRequest(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
    setConnected((prev) => { const next = new Set(prev); next.delete(provider); return next; });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">Add-Ons</h2>
        <div className={cn(CARD, 'relative max-w-xl overflow-hidden')}>
          <div className="pr-28">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-[#1a1c3a]">Stanley IG</div>
                <div className="text-sm text-neutral-400">Bundle add-on</div>
              </div>
              <Link href="/dashboard/settings?tab=billing" className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">Activate</Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <div>
                <div className="text-xs font-medium text-neutral-400">Status</div>
                <div className="mt-0.5 font-bold text-[#1a1c3a]">Action needed</div>
              </div>
              <div>
                <div className="text-xs font-medium text-neutral-400">Account</div>
                <div className="mt-0.5 font-bold text-[#1a1c3a]">Not connected yet</div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-1 right-4"><StanleyMascot /></div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">Integrations</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          {INTEGRATIONS.map((it) => {
            const isOn = connected.has(it.provider);
            return (
              <div key={it.name} className={cn(CARD, 'flex flex-col')}>
                <div className="flex items-center gap-3">
                  {it.logo}
                  <span className="text-lg font-bold text-[#1a1c3a]">{it.name}</span>
                  {isOn && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700"><IconCheckCircle size={13} /> Connected</span>}
                </div>
                <div className="mt-4 text-[15px] font-bold text-[#1a1c3a]">{it.tag}</div>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-neutral-500">{it.body}</p>
                <button className="mt-3 self-start text-sm font-bold text-brand-600 hover:text-brand-700">Learn More</button>
                {isOn ? (
                  <button onClick={() => disconnect(it.provider)} className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-line-strong bg-white py-3 text-sm font-bold text-[#1a1c3a] transition hover:bg-surface-muted">
                    Disconnect
                  </button>
                ) : (
                  <button onClick={() => connect(it.provider)} className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700">
                    <IconPlus size={16} /> Connect
                  </button>
                )}
              </div>
            );
          })}
          <div className={cn(CARD, 'flex flex-col items-center justify-center text-center')}>
            <div className="text-lg font-bold text-[#1a1c3a]">Don&apos;t see an integration?</div>
            <p className="mt-1.5 text-sm text-neutral-500">Let us know what you&apos;d like us to build next.</p>
            <button className="mt-5 rounded-full border border-brand-400 bg-white px-6 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50">Request integration</button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

interface PlanFeatures {
  maxProducts: number | null;
  courses: boolean;
  bookings: boolean;
  email: boolean;
  landingPages: boolean;
  autodm: boolean;
  stanleyAI: boolean;
  removeBranding: boolean;
}
interface Sub { plan: string; tier: string; nominalTier: string; status: string; label: string; priceCents: number; interval: string; stanleyAddon: boolean; trialEndsAt?: string; currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean; features: PlanFeatures; paymentMethod?: SavedCard | null; }
interface PlanOpt { key: string; tier: string; cents: number; interval: string; label: string; features: PlanFeatures; }

// Display rows for the comparison cards. `val` returns true/false (✓/✗) or text.
const FEATURE_ROWS: { label: string; val: (f: PlanFeatures) => boolean | string }[] = [
  { label: 'Digital products', val: (f) => (f.maxProducts === null ? 'Unlimited' : `${f.maxProducts}`) },
  { label: 'Courses', val: (f) => f.courses },
  { label: 'Bookings & appointments', val: (f) => f.bookings },
  { label: 'Email broadcasts & flows', val: (f) => f.email },
  { label: 'Landing pages', val: (f) => f.landingPages },
  { label: 'AutoDM', val: (f) => f.autodm },
  { label: 'Stanley AI assistant', val: (f) => f.stanleyAI },
  { label: 'Remove “Powered by Stan”', val: (f) => f.removeBranding },
];

const TIER_BLURB: Record<string, string> = {
  free: 'Get started and sell your first product.',
  pro: 'Everything you need to grow — unlimited products, courses, bookings & email.',
  premium: 'Pro + AutoDM and the Stanley AI assistant.',
};

function PlanPicker({ sub, plans, onSelect, busyKey }: { sub: Sub; plans: PlanOpt[]; onSelect: (key: string) => void; busyKey: string }) {
  const [interval, setIntervalState] = useState<'month' | 'year'>(sub.interval === 'year' ? 'year' : 'month');
  // One card per tier; for paid tiers pick the plan matching the billing interval.
  const cards = ['free', 'pro', 'premium'].map((tier) => {
    if (tier === 'free') return plans.find((p) => p.tier === 'free')!;
    return plans.find((p) => p.tier === tier && p.interval === interval) ?? plans.find((p) => p.tier === tier)!;
  });

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Choose your plan</h2>
        <div className="inline-flex rounded-full bg-[#f1f1f5] p-1 text-sm font-semibold">
          {(['month', 'year'] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setIntervalState(iv)}
              className={cn('rounded-full px-4 py-1.5 transition', interval === iv ? 'bg-white text-[#1a1c3a] shadow-xs' : 'text-neutral-500')}
            >
              {iv === 'month' ? 'Monthly' : 'Yearly'}{iv === 'year' && <span className="ml-1 text-xs font-bold text-brand-600">save</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {cards.map((p) => {
          const isCurrent = sub.nominalTier === p.tier && (p.tier === 'free' || sub.interval === p.interval) && sub.status !== 'canceled';
          const highlight = p.tier === 'pro';
          return (
            <div
              key={p.key}
              className={cn(
                'flex flex-col rounded-2xl border p-5',
                highlight ? 'border-brand-400 ring-1 ring-brand-200' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-[#1a1c3a]">{p.tier === 'free' ? 'Free' : p.label}</div>
                {highlight && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600">Popular</span>}
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-[#1a1c3a]">{formatPrice(p.cents)}</span>
                <span className="text-sm font-medium text-neutral-400">/{p.interval === 'year' ? 'yr' : 'mo'}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{TIER_BLURB[p.tier]}</p>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {FEATURE_ROWS.map((row) => {
                  const v = row.val(p.features);
                  const on = v === true || (typeof v === 'string');
                  return (
                    <li key={row.label} className="flex items-center gap-2">
                      <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold', on ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-400')}>
                        {on ? '✓' : '×'}
                      </span>
                      <span className={on ? 'text-[#1a1c3a]' : 'text-neutral-400'}>
                        {typeof v === 'string' ? `${v} ${row.label.toLowerCase()}` : row.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                disabled={isCurrent || busyKey === p.key}
                onClick={() => onSelect(p.key)}
                className={cn(
                  'mt-5 rounded-full px-4 py-2.5 text-sm font-bold transition disabled:cursor-default',
                  isCurrent
                    ? 'bg-[#eceef3] text-neutral-400'
                    : highlight
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'border border-brand-400 text-brand-600 hover:bg-brand-50',
                )}
              >
                {busyKey === p.key ? 'Updating…' : isCurrent ? 'Current plan' : p.tier === 'free' ? 'Downgrade' : 'Choose ' + (p.tier === 'free' ? 'Free' : p.label)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface InvoiceRow {
  id: string;
  number: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string;
}

function BillingTab({ initialSub }: { initialSub?: Sub }) {
  const { authedRequest } = useAuth();
  const [sub, setSub] = useState<Sub | null>(initialSub ?? null);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [demoCheckout, setDemoCheckout] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [busy, setBusy] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Checkout-confirmation flow for switching plans.
  const [pending, setPending] = useState<PlanOpt | null>(null);
  const [step, setStep] = useState<'confirm' | 'processing' | 'done'>('confirm');

  const load = useCallback(async () => {
    const res = await authedRequest<{ subscription: Sub; plans: PlanOpt[]; demoCheckout?: boolean }>('/api/subscription');
    setSub(res.subscription);
    setPlans(res.plans ?? []);
    setDemoCheckout(res.demoCheckout ?? true);
  }, [authedRequest]);
  const loadInvoices = useCallback(async () => {
    const res = await authedRequest<{ invoices: InvoiceRow[] }>('/api/subscription/invoices');
    setInvoices(res.invoices);
  }, [authedRequest]);
  useEffect(() => { void load(); void loadInvoices(); }, [load, loadInvoices]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('plan') === 'success') {
      const sessionId = params.get('session_id');
      if (sessionId && !demoCheckout) {
        void authedRequest<{ subscription: Sub }>('/api/subscription/complete', {
          method: 'POST',
          body: { sessionId },
        })
          .then((r) => {
            setSub(r.subscription);
            emitPlanChanged();
            void loadInvoices();
          })
          .catch(() => void load());
      } else {
        void load();
        void loadInvoices();
        emitPlanChanged();
      }
    }
  }, [authedRequest, demoCheckout, load, loadInvoices]);

  function requestSelect(plan: string) {
    const opt = plans.find((p) => p.key === plan);
    if (opt) { setStep('confirm'); setPending(opt); }
  }

  async function confirmSelect() {
    if (!pending) return;
    setStep('processing');
    try {
      const res = await authedRequest<{ subscription?: Sub; url?: string; demo?: boolean }>(
        '/api/subscription/select',
        { method: 'POST', body: { plan: pending.key } },
      );
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      if (res.subscription) setSub(res.subscription);
      emitPlanChanged();
      void loadInvoices();
      setStep('done');
    } catch {
      setPending(null);
      setStep('confirm');
    }
  }

  async function cancel() {
    setBusy('cancel');
    try {
      const res = await authedRequest<{ subscription: Sub }>('/api/subscription/cancel', { method: 'POST' });
      setSub(res.subscription);
      setConfirmingCancel(false);
    } finally { setBusy(''); }
  }

  async function resume() {
    setBusy('resume');
    try {
      const res = await authedRequest<{ subscription: Sub }>('/api/subscription/resume', { method: 'POST' });
      setSub(res.subscription);
      emitPlanChanged();
    } finally { setBusy(''); }
  }

  if (!sub) return <div className={CARD}><Skeleton className="h-48 w-full" /></div>;
  const fmtLong = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null);
  const trialDate = fmtLong(sub.trialEndsAt);
  const periodDate = fmtLong(sub.currentPeriodEnd);

  return (
    <div className="space-y-6">
      {plans.length > 0 && <PlanPicker sub={sub} plans={plans} onSelect={requestSelect} busyKey="" />}

      <Modal
        open={!!pending}
        onClose={() => { if (step !== 'processing') setPending(null); }}
        size="sm"
        title={step === 'done' ? "You're all set 🎉" : pending?.tier === 'free' ? 'Switch to Free' : `Upgrade to ${pending?.label}`}
      >
        {pending && step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-[#f6f6fc] p-4">
              <span className="font-bold text-[#1a1c3a]">{pending.tier === 'free' ? 'Free' : pending.label}</span>
              <span className="font-bold text-[#1a1c3a]">{formatPrice(pending.cents)}<span className="text-sm font-medium text-neutral-400">/{pending.interval === 'year' ? 'yr' : 'mo'}</span></span>
            </div>
            <p className="text-sm text-neutral-500">
              {pending.tier === 'free'
                ? "You'll lose access to paid features (courses, bookings, email, AutoDM…). You can re-subscribe anytime."
                : pending.tier === 'premium'
                  ? 'Unlocks everything, including AutoDM and the Stanley AI assistant.'
                  : 'Unlocks unlimited products, courses, bookings, email broadcasts & flows, and landing pages.'}
            </p>
            {demoCheckout && pending.tier !== 'free' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                Demo mode: Stripe isn&apos;t configured, so this is a simulated checkout — no card is charged.
              </div>
            )}
          </div>
        )}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            <p className="text-sm font-medium text-neutral-500">Processing your subscription…</p>
          </div>
        )}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-success-100 text-2xl text-success-700">✓</div>
            <p className="text-sm text-neutral-600">You&apos;re now on <strong>{sub.label}</strong>. Your features have been updated.</p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {step === 'confirm' && (
            <>
              <button type="button" onClick={() => setPending(null)} className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-ink">Cancel</button>
              <button type="button" onClick={confirmSelect} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700">
                {pending?.tier === 'free' ? 'Confirm downgrade' : 'Confirm & subscribe'}
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" onClick={() => setPending(null)} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700">Done</button>
          )}
        </div>
      </Modal>
      <div className={CARD}>
        <div className="grid gap-8 lg:grid-cols-2">
        {/* Subscription */}
        <div>
          <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">Your Stan Subscription</h2>
          <div className="rounded-2xl bg-[#f6f6fc] p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg font-bold text-[#1a1c3a]">{sub.label}</div>
              <div className="text-lg font-bold text-[#1a1c3a]">{formatPrice(sub.priceCents)}<span className="text-sm font-medium text-neutral-400">/{sub.interval}</span></div>
            </div>
            <div className="mt-2 text-sm capitalize text-neutral-500">Billed {sub.interval === 'year' ? 'Yearly' : 'Monthly'}</div>
            {sub.status === 'trialing' && trialDate && <div className="mt-1 text-sm text-neutral-500">Your trial expires on {trialDate}</div>}
            {sub.status === 'active' && !sub.cancelAtPeriodEnd && periodDate && (
              <div className="mt-1 text-sm text-neutral-500">Renews on {periodDate}</div>
            )}
          </div>

          {/* Scheduled-cancel banner */}
          {sub.cancelAtPeriodEnd && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your <strong>{sub.label}</strong> plan stays active until <strong>{periodDate}</strong>, then switches to Free. It won&apos;t renew and you won&apos;t be charged again — no refund for the current period.
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {sub.cancelAtPeriodEnd ? (
              <button onClick={resume} disabled={busy === 'resume'} className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
                {busy === 'resume' ? 'Resuming…' : 'Resume subscription'}
              </button>
            ) : sub.status !== 'canceled' && sub.tier !== 'free' ? (
              !confirmingCancel ? (
                <button onClick={() => setConfirmingCancel(true)} className="rounded-full border border-danger-300 bg-white px-5 py-2.5 text-sm font-bold text-danger-600 transition hover:bg-danger-50">
                  Cancel Subscription
                </button>
              ) : (
                <div className="w-full rounded-xl border border-line bg-white p-4">
                  <p className="text-sm text-neutral-600">
                    You&apos;ll keep <strong>{sub.label}</strong>{periodDate ? <> until <strong>{periodDate}</strong></> : ''}, then move to Free. No further charges and no refund for the current period.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={cancel} disabled={busy === 'cancel'} className="rounded-full bg-danger-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-danger-700 disabled:opacity-50">
                      {busy === 'cancel' ? 'Cancelling…' : 'Confirm cancellation'}
                    </button>
                    <button onClick={() => setConfirmingCancel(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-ink">Keep my plan</button>
                  </div>
                </div>
              )
            ) : null}
            {!confirmingCancel && !sub.cancelAtPeriodEnd && (
              <Link href="/dashboard/settings?tab=billing" className="rounded-full border border-brand-400 bg-white px-5 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50">Manage Stanley IG</Link>
            )}
          </div>
        </div>

        {/* Payment details */}
        <PaymentDetails card={sub.paymentMethod ?? null} onChange={(s) => setSub(s as Sub)} />
        </div>
      </div>

      {/* Invoices */}
      <div className={CARD}>
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Invoices</h2>
        <p className="mt-1 text-sm text-neutral-500">Receipts for your Stan subscription. View or download (Save as PDF) any invoice.</p>
        <div className="mt-5 overflow-x-auto">
          {invoices === null ? (
            <Skeleton className="h-24 w-full" />
          ) : invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No invoices yet — they appear here after your first paid subscription charge.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left text-sm font-bold text-[#1a1c3a]">
                  <th className="px-2 pb-3">Invoice</th>
                  <th className="px-2 pb-3">Amount</th>
                  <th className="px-2 pb-3">Status</th>
                  <th className="px-2 pb-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line/70 text-[15px] last:border-0">
                    <td className="px-2 py-4">
                      <div className="font-semibold text-[#1a1c3a]">{inv.description}</div>
                      <div className="text-xs text-neutral-400">{inv.number} · {new Date(inv.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    </td>
                    <td className="px-2 py-4 text-neutral-600">{formatPrice(inv.amountCents)}</td>
                    <td className="px-2 py-4"><span className="rounded-md bg-success-50 px-2 py-0.5 text-xs font-semibold capitalize text-success-700">{inv.status}</span></td>
                    <td className="px-2 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a href={`/dashboard/billing/invoice/${inv.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-1.5 text-sm font-semibold text-ink hover:bg-surface-muted"><IconEye size={15} /> View</a>
                        <a href={`/dashboard/billing/invoice/${inv.id}?download=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-1.5 text-sm font-semibold text-brand-600 hover:bg-surface-muted"><IconDownload size={15} /> Download</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

interface ConnectStatus {
  connected?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  stripeConfigured?: boolean;
  demoCheckout?: boolean;
}

interface PayPalStatus { connected: boolean; email: string; configured: boolean; demo: boolean }

function PaymentsTab() {
  const { authedRequest } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectMsg, setConnectMsg] = useState('');
  const [gdpr, setGdpr] = useState(true);
  const [terms, setTerms] = useState(false);

  const [pp, setPp] = useState<PayPalStatus | null>(null);
  const [ppEmail, setPpEmail] = useState('');
  const [ppBusy, setPpBusy] = useState(false);
  const [ppErr, setPpErr] = useState('');

  const refreshStatus = useCallback(
    async (fromStripe = false) => {
      try {
        const res = await authedRequest<{ account: ConnectStatus }>(
          `/api/payments/connect/status${fromStripe ? '?refresh=1' : ''}`,
        );
        setStatus(res.account);
        return res.account;
      } catch {
        return null;
      }
    },
    [authedRequest],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get('connect');
    const fromStripe = connect === 'return' || connect === 'refresh';
    void refreshStatus(fromStripe).then((account) => {
      if (connect === 'return') {
        if (account?.chargesEnabled) {
          setConnectMsg('Stripe connected — you can accept card payments.');
        } else if (account?.connected) {
          setConnectMsg('Stripe account linked. Finish any remaining verification steps in Stripe if prompted.');
        } else {
          setConnectMsg('Returned from Stripe. If setup is complete, try refreshing this page.');
        }
      }
      if (fromStripe) {
        router.replace('/dashboard/settings?tab=payments', { scroll: false });
      }
    });
    authedRequest<{ paypal: PayPalStatus }>('/api/payments/connect/paypal/status')
      .then((r) => { setPp(r.paypal); setPpEmail(r.paypal.email); })
      .catch(() => {});
  }, [authedRequest, refreshStatus, router]);

  async function register() {
    setBusy(true);
    setConnectMsg('');
    try {
      const res = await authedRequest<{ url: string }>('/api/payments/connect/onboard', {
        method: 'POST',
        body: { returnBase: window.location.origin },
      });
      window.location.href = res.url;
    } catch { setBusy(false); }
  }

  async function connectPayPal() {
    setPpBusy(true); setPpErr('');
    try {
      const r = await authedRequest<{ paypalEmail: string }>('/api/payments/connect/paypal/connect', { method: 'POST', body: { email: ppEmail } });
      setPp((p) => (p ? { ...p, connected: true, email: r.paypalEmail } : p));
    } catch (e) {
      setPpErr(e instanceof ApiException ? e.message : 'Could not connect PayPal');
    } finally { setPpBusy(false); }
  }

  async function disconnectPayPal() {
    setPpBusy(true); setPpErr('');
    try {
      await authedRequest('/api/payments/connect/paypal/disconnect', { method: 'POST' });
      setPp((p) => (p ? { ...p, connected: false, email: '' } : p));
      setPpEmail('');
    } catch (e) {
      setPpErr(e instanceof ApiException ? e.message : 'Could not disconnect PayPal');
    } finally { setPpBusy(false); }
  }

  const connected = status?.chargesEnabled;

  return (
    <div className={CARD}>
      <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Payment Methods</h2>
      <p className="mt-1 text-sm text-neutral-500">Please connect your bank account using a Payment Provider to start selling!</p>

      {connectMsg && (
        <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">{connectMsg}</p>
      )}

      <div className="mt-5 max-w-2xl">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-subtle px-6 py-5">
          <span className="text-2xl font-extrabold tracking-tight text-[#635bff]">stripe</span>
          {connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-4 py-2 text-sm font-bold text-success-700"><IconCheckCircle size={16} /> Connected</span>
          ) : (
            <button onClick={register} disabled={busy} className="rounded-full bg-brand-600 px-7 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {busy ? 'Redirecting…' : 'Register'}
            </button>
          )}
        </div>
        {/* PayPal */}
        <div className="mt-3 rounded-2xl bg-surface-subtle px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xl font-extrabold italic tracking-tight">
              <span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span>
            </span>
            {pp?.connected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-4 py-2 text-sm font-bold text-success-700"><IconCheckCircle size={16} /> Connected</span>
                <button onClick={disconnectPayPal} disabled={ppBusy} className="rounded-full border border-line-strong px-4 py-2 text-sm font-bold text-neutral-600 transition hover:bg-white disabled:opacity-50">Disconnect</button>
              </div>
            ) : (
              <div className="flex w-full max-w-sm items-center gap-2 sm:w-auto">
                <input
                  type="email"
                  placeholder="your-paypal@email.com"
                  value={ppEmail}
                  onChange={(e) => setPpEmail(e.target.value)}
                  className={cn(INPUT, 'flex-1')}
                />
                <button onClick={connectPayPal} disabled={ppBusy || !ppEmail.trim()} className="shrink-0 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
                  {ppBusy ? '…' : 'Connect'}
                </button>
              </div>
            )}
          </div>
          {pp?.connected && (
            <p className="mt-2 text-sm text-neutral-500">PayPal payments are paid out to <span className="font-semibold text-[#1a1c3a]">{pp.email}</span>.</p>
          )}
          {pp && !pp.connected && (
            <p className="mt-2 text-sm text-neutral-500">Enter the PayPal email where buyers&apos; payments should be sent.</p>
          )}
          {pp?.demo && (
            <p className="mt-2 text-xs font-medium text-amber-700">Demo mode: PayPal isn&apos;t configured on this platform, so PayPal checkout is simulated — no real payment is taken.</p>
          )}
          {pp && !pp.configured && !pp.demo && (
            <p className="mt-2 text-xs font-medium text-amber-700">PayPal isn&apos;t enabled on this platform yet. Connecting an email has no effect until it is.</p>
          )}
          {ppErr && <p className="mt-2 text-xs font-medium text-red-600">{ppErr}</p>}
        </div>
      </div>

      <div className="mt-8 max-w-2xl space-y-6">
        <div className="flex items-start gap-3">
          <Toggle on={gdpr} onClick={() => setGdpr((v) => !v)} />
          <div>
            <div className="font-bold text-[#1a1c3a]">Enable Marketing Consent (GDPR)</div>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">Selling to EU or UK customers? This helps keep things GDPR-friendly. When enabled, only customers who check the box can get marketing emails. Optional, but recommended if you&apos;ve got a global audience.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Toggle on={terms} onClick={() => setTerms((v) => !v)} />
          <div>
            <div className="font-bold text-[#1a1c3a]">Enable Terms &amp; Conditions</div>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">When enabled, customers are required to agree to the terms and conditions before the sale can be completed. The agreement checkbox will appear on each checkout page.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Email Notifications                                                 */
/* ------------------------------------------------------------------ */

const PREFS: { key: string; group: 'To Me' | 'To Customers'; title: string; body: string }[] = [
  { key: 'calendarBookings', group: 'To Me', title: 'Calendar Bookings', body: 'Receive an email when someone creates a new calendar booking' },
  { key: 'ordersFulfillment', group: 'To Me', title: 'Orders That Require Fulfillment', body: 'Receive an email when someone purchases a Personalized Video Response product prompting you to fulfill order' },
  { key: 'purchaseConfirmations', group: 'To Me', title: 'Purchase Confirmations', body: 'Receive an email notification each time a customer purchases something from you' },
  { key: 'leadCaptured', group: 'To Me', title: 'Lead Captured', body: 'Receive an email notification each time you capture a new lead' },
  { key: 'membershipCancellations', group: 'To Me', title: 'Membership Cancellations', body: 'Receive an email each time a customer cancels a subscription or when their access expires' },
  { key: 'recurringPayments', group: 'To Customers', title: 'Recurring Payments', body: 'Send an email to subscribers each time they make a recurring payment' },
];

function NotificationsTab() {
  const { authedRequest } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    authedRequest<{ prefs: Record<string, boolean> }>('/api/account/notifications').then((r) => setPrefs(r.prefs ?? {})).catch(() => {});
  }, [authedRequest]);

  async function toggle(key: string) {
    if (!prefs) return;
    const nextVal = prefs[key] === false;
    setPrefs({ ...prefs, [key]: nextVal });
    await authedRequest('/api/account/notifications', { method: 'PATCH', body: { [key]: nextVal } }).catch(() => {});
  }

  if (!prefs) return <div className={CARD}><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className={CARD}>
      {(['To Me', 'To Customers'] as const).map((group) => (
        <div key={group} className="mb-8 last:mb-0">
          <h2 className="mb-5 text-lg font-bold tracking-tight text-[#1a1c3a]">{group}</h2>
          <div className="space-y-5">
            {PREFS.filter((p) => p.group === group).map((p) => (
              <div key={p.key} className="flex items-start gap-3">
                <Toggle on={prefs[p.key] !== false} onClick={() => toggle(p.key)} />
                <div>
                  <div className="font-bold text-[#1a1c3a]">{p.title}</div>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

interface Session { id: string; userAgent: string; ip: string; createdAt: string; current: boolean; }

interface TwoFactorStatus {
  enabled: boolean;
  email: boolean;
  authenticator: boolean;
  methods: ('email' | 'authenticator')[];
}

interface AuthSetup {
  qrDataUrl: string;
  secret: string;
  otpauthUrl: string;
}

function deviceLabel(ua: string): string {
  if (!ua) return 'Unknown device';
  const browser = /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Browser';
  const os = /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : '';
  return os ? `${browser} - ${os}` : browser;
}

function SecurityTab() {
  const { authedRequest, logout } = useAuth();
  const router = useRouter();
  const [twoFA, setTwoFA] = useState<TwoFactorStatus | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  // Password-gated actions
  const [pwModal, setPwModal] = useState<'email-on' | 'email-off' | 'auth-setup' | 'auth-disable' | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Authenticator setup
  const [authSetup, setAuthSetup] = useState<AuthSetup | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const load = useCallback(async () => {
    authedRequest<TwoFactorStatus>('/api/account/two-factor')
      .then((r) => setTwoFA(r))
      .catch(() => setTwoFA({ enabled: false, email: false, authenticator: false, methods: [] }));
    authedRequest<{ sessions: Session[] }>('/api/account/sessions').then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function toggleEmail(enabled: boolean) {
    setPwModal(enabled ? 'email-on' : 'email-off');
    setPassword('');
    setError('');
  }

  async function submitPasswordAction() {
    if (!pwModal || !password) return;
    setBusy(true);
    setError('');
    try {
      if (pwModal === 'email-on' || pwModal === 'email-off') {
        const status = await authedRequest<TwoFactorStatus>('/api/account/two-factor/email', {
          method: 'POST',
          body: { enabled: pwModal === 'email-on', password },
        });
        setTwoFA(status);
        setPwModal(null);
        setPassword('');
      } else if (pwModal === 'auth-setup') {
        const setup = await authedRequest<AuthSetup>('/api/account/two-factor/authenticator/setup', {
          method: 'POST',
          body: { password },
        });
        setAuthSetup(setup);
        setPwModal(null);
        setPassword('');
        setConfirmCode('');
      } else if (pwModal === 'auth-disable') {
        const status = await authedRequest<TwoFactorStatus>('/api/account/two-factor/authenticator/disable', {
          method: 'POST',
          body: { password, code: disableCode },
        });
        setTwoFA(status);
        setPwModal(null);
        setPassword('');
        setDisableCode('');
        setAuthSetup(null);
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function cancelAuthenticatorSetup() {
    await authedRequest('/api/account/two-factor/authenticator/cancel', { method: 'POST' }).catch(() => {});
    setAuthSetup(null);
    setConfirmCode('');
    setError('');
  }

  async function confirmAuthenticator() {
    if (confirmCode.length < 6 || !authSetup?.secret) return;
    setBusy(true);
    setError('');
    try {
      const status = await authedRequest<TwoFactorStatus>('/api/account/two-factor/authenticator/confirm', {
        method: 'POST',
        body: { code: confirmCode, secret: authSetup.secret },
      });
      setTwoFA(status);
      setAuthSetup(null);
      setConfirmCode('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Incorrect code');
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    await authedRequest('/api/account/sessions/revoke-others', { method: 'POST' }).catch(() => {});
    await load();
  }
  async function revokeOne(id: string) {
    await authedRequest(`/api/account/sessions/${id}/revoke`, { method: 'POST' }).catch(() => {});
    await load();
  }
  async function deleteAccount() {
    await authedRequest('/api/account/delete', { method: 'POST' }).catch(() => {});
    await logout();
    router.replace('/login');
  }

  return (
    <div className={CARD}>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Two-Factor Verification</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Choose how you verify your identity at login. You can enable one or both methods.
        </p>
      </div>

      {twoFA === null ? (
        <Skeleton className="mt-5 h-32 w-full" />
      ) : (
        <div className="mt-5 space-y-4">
          {/* Email verification */}
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
            <Toggle on={twoFA.email} onClick={() => void toggleEmail(!twoFA.email)} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#1a1c3a]">Email verification</div>
              <p className="mt-0.5 text-sm text-neutral-500">
                Receive a 6-digit code by email each time you log in.
              </p>
            </div>
          </div>

          {/* Authenticator app */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start gap-3">
              <Toggle
                on={twoFA.authenticator}
                onClick={() => {
                  if (twoFA.authenticator) {
                    setPwModal('auth-disable');
                    setPassword('');
                    setDisableCode('');
                    setError('');
                  } else if (!authSetup) {
                    setPwModal('auth-setup');
                    setPassword('');
                    setError('');
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#1a1c3a]">Authenticator app</div>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Use Google Authenticator, Authy, 1Password, or any TOTP app.
                </p>
              </div>
            </div>

            {authSetup && !twoFA.authenticator && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm font-semibold text-[#1a1c3a]">Scan this QR code</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Remove any existing Stan entry in your app first, then scan this code or enter the secret manually.
                </p>
                <div className="mt-3 flex flex-wrap items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={authSetup.qrDataUrl} alt="Authenticator QR code" className="h-[200px] w-[200px] rounded-xl border border-line" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Manual entry key</p>
                    <code className="mt-1 block break-all rounded-lg bg-surface-subtle px-3 py-2 text-sm font-mono text-[#1a1c3a]">{authSetup.secret}</code>
                  </div>
                </div>
                <div className="mt-4">
                  <FieldLabel>Enter the 6-digit code from your app</FieldLabel>
                  <input
                    inputMode="numeric"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className={`${INPUT} mt-1 text-center tracking-[0.4em]`}
                  />
                </div>
                {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy || confirmCode.length < 6}
                    onClick={() => void confirmAuthenticator()}
                    className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    {busy ? 'Verifying…' : 'Confirm & enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelAuthenticatorSetup()}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {twoFA.enabled && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Two-factor is active via {twoFA.methods.join(' and ')}.
            </p>
          )}
        </div>
      )}

      <Modal
        open={pwModal !== null && pwModal !== 'auth-disable'}
        onClose={() => { setPwModal(null); setPassword(''); setError(''); }}
        title={
          pwModal === 'email-on' ? 'Enable email verification'
            : pwModal === 'email-off' ? 'Disable email verification'
              : 'Set up authenticator app'
        }
        subtitle="Enter your password to continue."
        footer={
          <button
            type="button"
            disabled={busy || !password}
            onClick={() => void submitPasswordAction()}
            className="w-full rounded-full bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : 'Continue'}
          </button>
        }
      >
        <PwField label="Password" value={password} onChange={setPassword} />
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      </Modal>

      <Modal
        open={pwModal === 'auth-disable'}
        onClose={() => { setPwModal(null); setPassword(''); setDisableCode(''); setError(''); }}
        title="Disable authenticator app"
        subtitle="Enter your password and a current authenticator code."
        footer={
          <button
            type="button"
            disabled={busy || !password || disableCode.length < 6}
            onClick={() => void submitPasswordAction()}
            className="w-full rounded-full bg-danger-600 py-3 text-sm font-bold text-white hover:bg-danger-700 disabled:opacity-50"
          >
            {busy ? 'Disabling…' : 'Disable authenticator'}
          </button>
        }
      >
        <PwField label="Password" value={password} onChange={setPassword} />
        <div className="mt-3">
          <FieldLabel>Authenticator code</FieldLabel>
          <input
            inputMode="numeric"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className={`${INPUT} mt-1 text-center tracking-[0.4em]`}
          />
        </div>
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      </Modal>

      <div className="mt-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Login Sessions</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Places where you&apos;re logged into Stan. If you do not recognize a session, you can terminate it below.</p>
          </div>
          <button onClick={revokeOthers} className="rounded-full border border-brand-400 bg-white px-5 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50">Sign out all other sessions</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          {sessions === null ? <Skeleton className="h-16 w-full" /> : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left text-sm font-bold text-[#1a1c3a]">
                  <th className="px-2 pb-3">Location</th>
                  <th className="px-2 pb-3">Device</th>
                  <th className="px-2 pb-3">IP Address</th>
                  <th className="px-2 pb-3">Login Time</th>
                  <th className="px-2 pb-3" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-line/70 text-[15px] last:border-0">
                    <td className="px-2 py-4 text-neutral-500">—</td>
                    <td className="px-2 py-4 text-[#1a1c3a]">{deviceLabel(s.userAgent)}</td>
                    <td className="px-2 py-4 text-neutral-500">{s.ip || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-4 text-neutral-500">{new Date(s.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="px-2 py-4 text-right">
                      {s.current ? (
                        <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-600">Current Session</span>
                      ) : (
                        <button onClick={() => revokeOne(s.id)} className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:border-danger-300 hover:text-danger-600">
                          Sign out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Request Account Deletion</h2>
        <p className="mt-0.5 max-w-md text-sm text-neutral-500"><span className="font-bold text-[#1a1c3a]">Are you sure?</span> Deleting your store permanently erases all of your data and content, and can&apos;t be undone.</p>
        <div className="mt-4">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="rounded-full border border-danger-300 bg-white px-6 py-2.5 text-sm font-bold text-danger-600 transition hover:bg-danger-50">Delete My Account</button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={deleteAccount} className="rounded-full bg-danger-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-danger-700">Yes, delete everything</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-full px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:text-ink">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const tabParam = params.get('tab');
  const connectParam = params.get('connect');
  const initial: TabKey =
    tabParam && VALID.includes(tabParam as TabKey)
      ? (tabParam as TabKey)
      : connectParam
        ? 'payments'
        : 'profile';
  const [tab, setTab] = useState<TabKey>(initial);

  useEffect(() => {
    const t = params.get('tab');
    if (t && VALID.includes(t as TabKey)) setTab(t as TabKey);
    else if (params.get('connect')) setTab('payments');
  }, [params]);

  function go(t: TabKey) {
    setTab(t);
    router.replace(`/dashboard/settings?tab=${t}`, { scroll: false });
  }

  return (
    <>
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <button onClick={() => go('payments')} className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</button>{' '}
        to start selling
      </div>

      {/* Tab bar */}
      <div className="mt-6 flex flex-wrap gap-3">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => go(t.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition',
                active ? 'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200' : 'border border-line bg-white text-brand-600 hover:bg-brand-50/50',
              )}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-7">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'billing' && <BillingTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <DashboardShell title="My Account Settings" maxWidth="max-w-[1280px]" hideTitle hideSubtitle>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SettingsView />
      </Suspense>
    </DashboardShell>
  );
}
