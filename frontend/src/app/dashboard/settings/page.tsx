'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton } from '@/components/ui';
import {
  IconUsers, IconPlus, IconDollar, IconCard, IconBell, IconLock, IconShield, IconEye,
  IconDownload, IconCheckCircle, IconChevronDown,
} from '@/components/icons';
import { formatPrice, type CreatorProfile } from '@/lib/types';
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
        <button className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-100">Upgrade Now</button>
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
              <button className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">Activate</button>
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

interface Sub { plan: string; status: string; label: string; priceCents: number; interval: string; stanleyAddon: boolean; trialEndsAt?: string; }

function BillingTab({ initialSub }: { initialSub?: Sub }) {
  const { authedRequest } = useAuth();
  const [sub, setSub] = useState<Sub | null>(initialSub ?? null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const res = await authedRequest<{ subscription: Sub }>('/api/subscription');
    setSub(res.subscription);
  }, [authedRequest]);
  useEffect(() => { if (initialSub !== undefined) return; void load(); }, [load, initialSub]);

  async function cancel() {
    setBusy('cancel');
    try {
      const res = await authedRequest<{ subscription: Sub }>('/api/subscription/cancel', { method: 'POST' });
      setSub(res.subscription);
    } finally { setBusy(''); }
  }

  if (!sub) return <div className={CARD}><Skeleton className="h-48 w-full" /></div>;
  const trialDate = sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div className="space-y-6">
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
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {sub.status !== 'canceled' && (
              <button onClick={cancel} disabled={busy === 'cancel'} className="rounded-full border border-danger-300 bg-white px-5 py-2.5 text-sm font-bold text-danger-600 transition hover:bg-danger-50 disabled:opacity-50">
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel Subscription'}
              </button>
            )}
            <button className="rounded-full border border-brand-400 bg-white px-5 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50">Manage Stanley IG</button>
          </div>
        </div>

        {/* Payment details */}
        <div>
          <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a1c3a]">Payment Details</h2>
          <div className="space-y-4">
            <div className="relative">
              <input className={cn(INPUT, 'pr-12')} placeholder="Card number" />
              <IconCard size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input className={INPUT} placeholder="Expiration date" />
              <input className={INPUT} placeholder="Security code" />
            </div>
            <PrimaryBtn>Update</PrimaryBtn>
          </div>
        </div>
        </div>
      </div>

      {/* Invoices */}
      <div className={CARD}>
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Invoices</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line text-left text-sm font-bold text-[#1a1c3a]">
                <th className="px-2 pb-3">Date</th>
                <th className="px-2 pb-3">Amount</th>
                <th className="px-2 pb-3">Status</th>
                <th className="px-2 pb-3" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/70 text-[15px] last:border-0">
                <td className="px-2 py-4 text-brand-600">{trialDate ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                <td className="px-2 py-4 text-neutral-500">{formatPrice(0)}</td>
                <td className="px-2 py-4"><span className="rounded-md bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">Paid</span></td>
                <td className="px-2 py-4 text-right">
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-1.5 text-sm font-semibold text-brand-600 hover:bg-surface-muted"><IconDownload size={15} /> Download</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

interface ConnectStatus { chargesEnabled?: boolean; payoutsEnabled?: boolean; detailsSubmitted?: boolean; }
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch'];

function PaymentsTab() {
  const { authedRequest } = useAuth();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [gdpr, setGdpr] = useState(true);
  const [terms, setTerms] = useState(false);
  const [lang, setLang] = useState('English');

  useEffect(() => {
    authedRequest<{ account: ConnectStatus }>('/api/payments/connect/status').then((r) => setStatus(r.account)).catch(() => {});
  }, [authedRequest]);

  async function register() {
    setBusy(true);
    try {
      const res = await authedRequest<{ url: string }>('/api/payments/connect/onboard', { method: 'POST' });
      window.location.href = res.url;
    } catch { setBusy(false); }
  }

  const connected = status?.chargesEnabled;

  return (
    <div className={CARD}>
      <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Payment Methods</h2>
      <p className="mt-1 text-sm text-neutral-500">Please connect your bank account using a Payment Provider to start selling!</p>

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
        <div className="mt-3 flex justify-end">
          <button className="text-sm font-bold text-brand-600 hover:text-brand-700">+ Add PayPal</button>
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
        <div>
          <div className="font-bold text-[#1a1c3a]">Change Store Checkout Language</div>
          <p className="mt-1 text-sm text-neutral-500">Set the language customers will see on the checkout page from your storefront.</p>
          <div className="relative mt-3 max-w-xs">
            <select value={lang} onChange={(e) => setLang(e.target.value)} className={cn(INPUT, 'cursor-pointer appearance-none pr-10')}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
            <IconChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
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
    const nextVal = !prefs[key];
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
                <Toggle on={!!prefs[p.key]} onClick={() => toggle(p.key)} />
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

function deviceLabel(ua: string): string {
  if (!ua) return 'Unknown device';
  const browser = /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Browser';
  const os = /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : '';
  return os ? `${browser} - ${os}` : browser;
}

function SecurityTab() {
  const { authedRequest, logout } = useAuth();
  const router = useRouter();
  const [twoFA, setTwoFA] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    authedRequest<{ twoFactorEnabled: boolean }>('/api/account/notifications').then((r) => setTwoFA(!!r.twoFactorEnabled)).catch(() => setTwoFA(false));
    authedRequest<{ sessions: Session[] }>('/api/account/sessions').then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function toggle2fa() {
    const nextVal = !twoFA;
    setTwoFA(nextVal);
    await authedRequest('/api/account/two-factor', { method: 'POST', body: { enabled: nextVal } }).catch(() => {});
  }
  async function revokeOthers() {
    await authedRequest('/api/account/sessions/revoke-others', { method: 'POST' }).catch(() => {});
    await load();
  }
  async function deleteAccount() {
    await authedRequest('/api/account/delete', { method: 'POST' }).catch(() => {});
    await logout();
    router.replace('/login');
  }

  return (
    <div className={CARD}>
      <div className="flex items-start gap-3">
        <Toggle on={!!twoFA} onClick={toggle2fa} />
        <div>
          <div className="font-bold text-[#1a1c3a]">Two-Factor Verification</div>
          <p className="mt-0.5 text-sm text-neutral-500">Add an additional layer of security to your account during login.</p>
        </div>
      </div>

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
                    <td className="px-2 py-4 text-right">{s.current && <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-600">Current Session</span>}</td>
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
  const initial = params.get('tab');
  const [tab, setTab] = useState<TabKey>(initial && VALID.includes(initial as TabKey) ? (initial as TabKey) : 'profile');

  useEffect(() => {
    const t = params.get('tab');
    if (t && VALID.includes(t as TabKey)) setTab(t as TabKey);
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
