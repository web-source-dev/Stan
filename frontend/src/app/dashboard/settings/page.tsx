'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, Button, Badge, Alert, SectionHeading, Tabs, Field, Skeleton } from '@/components/ui';
import { ConnectCard } from '@/components/ConnectCard';
import {
  IconCheckCircle, IconLock, IconLogout, IconSettings, IconCard, IconBell, IconShield, IconLink, IconDollar,
} from '@/components/icons';
import { formatPrice, type CreatorProfile } from '@/lib/types';

type TabKey = 'profile' | 'integrations' | 'billing' | 'payments' | 'notifications' | 'security';

const TABS: { value: TabKey; label: string; icon: React.ReactNode }[] = [
  { value: 'profile', label: 'Profile', icon: <IconSettings size={16} /> },
  { value: 'integrations', label: 'Integrations', icon: <IconLink size={16} /> },
  { value: 'billing', label: 'Billing', icon: <IconDollar size={16} /> },
  { value: 'payments', label: 'Payments', icon: <IconCard size={16} /> },
  { value: 'notifications', label: 'Email Notifications', icon: <IconBell size={16} /> },
  { value: 'security', label: 'Security', icon: <IconShield size={16} /> },
];

function SettingsView() {
  const [tab, setTab] = useState<TabKey>('profile');
  return (
    <DashboardShell title="My Account Settings" subtitle="Manage your profile, billing and security." maxWidth="max-w-5xl">
      <Tabs className="mb-7" value={tab} onChange={setTab} tabs={TABS} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'billing' && <BillingTab />}
      {tab === 'payments' && <div className="max-w-xl"><ConnectCard /></div>}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'security' && <SecurityTab />}
    </DashboardShell>
  );
}

/* ---------------- Profile ---------------- */
function ProfileTab() {
  const { user, authedRequest } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile').then((r) => {
      if (r.profile) { setProfile(r.profile); setName(r.profile.displayName); }
    }).catch(() => {});
  }, [authedRequest]);

  async function save() {
    setStatus('saving');
    try {
      const res = await authedRequest<{ profile: CreatorProfile }>('/api/creator/profile', { method: 'PATCH', body: { displayName: name } });
      setProfile(res.profile);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch { setStatus('idle'); }
  }

  async function sendReset() {
    if (!user) return;
    setResetState('sending');
    await apiRequest('/api/auth/forgot-password', { method: 'POST', body: { email: user.email } }).catch(() => {});
    setResetState('sent');
  }

  if (!profile) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading title="My Profile" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Username" value={profile.username} disabled hint="Your store URL handle." />
          <Field label="Email" value={user?.email ?? ''} disabled />
          <div className="flex items-end">
            {!user?.emailVerified ? <Badge tone="warn" dot>Email not verified</Badge> : <Badge tone="success" dot>Email verified</Badge>}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} loading={status === 'saving'}>Update</Button>
          {status === 'saved' && <span className="flex items-center gap-1 text-sm font-medium text-success-600"><IconCheckCircle size={15} /> Saved</span>}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Password" subtitle="Reset your password via a secure email link." />
        <div className="mt-5">
          {resetState === 'sent'
            ? <Alert kind="success">If an account exists for {user?.email}, a reset link is on its way.</Alert>
            : <Button variant="secondary" onClick={sendReset} loading={resetState === 'sending'}><IconLock size={16} /> Send password reset email</Button>}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Integrations ---------------- */
const INTEGRATIONS = [
  { name: 'Google Calendar', body: 'Keep bookings in sync with your calendar.' },
  { name: 'Zoom', body: 'Auto-create meeting links for booked calls.' },
  { name: 'Zapier', body: 'Connect Stan to 6,000+ apps and automate workflows.' },
  { name: 'Instagram', body: 'Send automated replies to comments and DMs.' },
];
function IntegrationsTab() {
  return (
    <div>
      <Card className="mb-6 bg-brand-gradient text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">Stanley AI <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-2xs uppercase">Add-on</span></div>
            <p className="mt-1 text-sm text-white/80">Your AI content engine & creator coach.</p>
          </div>
          <Button variant="secondary">Activate</Button>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((it) => (
          <Card key={it.name}>
            <div className="font-semibold">{it.name}</div>
            <p className="mt-1 text-sm text-neutral-500">{it.body}</p>
            <Button variant="secondary" size="sm" className="mt-4" fullWidth>Connect</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Billing ---------------- */
interface Sub { plan: string; status: string; label: string; priceCents: number; interval: string; stanleyAddon: boolean; trialEndsAt?: string; }
const PLANS: { plan: 'monthly' | 'yearly' | 'bundle'; title: string; price: string; note: string; badge?: string }[] = [
  { plan: 'monthly', title: 'Monthly', price: '$29/mo', note: '$0 for 14 days, then $29/mo' },
  { plan: 'yearly', title: 'Yearly', price: '$300/yr', note: '$0 for 14 days, then $300/yr', badge: 'Save 20%' },
  { plan: 'bundle', title: 'Creator + Stanley AI', price: '$49/mo', note: '14-day free trial, then $49/mo', badge: 'Bundle' },
];
function BillingTab() {
  const { authedRequest } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const res = await authedRequest<{ subscription: Sub }>('/api/subscription');
    setSub(res.subscription);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function select(plan: string) {
    setBusy(plan);
    try {
      const res = await authedRequest<{ subscription: Sub }>('/api/subscription/select', { method: 'POST', body: { plan } });
      setSub(res.subscription);
    } finally { setBusy(''); }
  }
  async function cancel() {
    setBusy('cancel');
    try {
      const res = await authedRequest<{ subscription: Sub }>('/api/subscription/cancel', { method: 'POST' });
      setSub(res.subscription);
    } finally { setBusy(''); }
  }

  if (!sub) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{sub.label}</div>
            <div className="mt-0.5 text-sm text-neutral-500 capitalize">
              {sub.status === 'trialing' && sub.trialEndsAt
                ? `Trial ends ${new Date(sub.trialEndsAt).toLocaleDateString()}`
                : sub.status}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatPrice(sub.priceCents)}<span className="text-sm font-medium text-neutral-400">/{sub.interval}</span></div>
            <Badge tone={sub.status === 'canceled' ? 'neutral' : 'success'} dot>{sub.status}</Badge>
          </div>
        </div>
        {sub.status !== 'canceled' && (
          <Button variant="outline" size="sm" className="mt-4 text-danger-600" onClick={cancel} loading={busy === 'cancel'}>Cancel subscription</Button>
        )}
      </Card>

      <div>
        <SectionHeading title="Change plan" subtitle="Pick the plan that fits — switch anytime." />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const active = sub.plan === p.plan;
            return (
              <Card key={p.plan} className={active ? 'ring-2 ring-brand-300' : ''}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.title}</span>
                  {p.badge && <Badge tone="brand">{p.badge}</Badge>}
                </div>
                <div className="mt-2 text-xl font-bold">{p.price}</div>
                <p className="mt-1 text-xs text-neutral-500">{p.note}</p>
                <Button
                  variant={active ? 'secondary' : 'primary'} size="sm" fullWidth className="mt-4"
                  disabled={active} loading={busy === p.plan} onClick={() => select(p.plan)}
                >
                  {active ? 'Current plan' : 'Choose plan'}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Notifications ---------------- */
const PREF_FIELDS: { key: string; group: 'To Me' | 'To Customers'; title: string; body: string }[] = [
  { key: 'calendarBookings', group: 'To Me', title: 'Calendar Bookings', body: 'Email when someone creates a new calendar booking.' },
  { key: 'ordersFulfillment', group: 'To Me', title: 'Orders That Require Fulfillment', body: 'Email when an order needs you to fulfill it.' },
  { key: 'purchaseConfirmations', group: 'To Me', title: 'Purchase Confirmations', body: 'Email each time a customer buys something.' },
  { key: 'leadCaptured', group: 'To Me', title: 'Lead Captured', body: 'Email each time you capture a new lead.' },
  { key: 'membershipCancellations', group: 'To Me', title: 'Membership Cancellations', body: 'Email when a subscription is cancelled or expires.' },
  { key: 'recurringPayments', group: 'To Customers', title: 'Recurring Payments', body: 'Email subscribers each time they make a recurring payment.' },
];
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-brand-600' : 'bg-neutral-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
function NotificationsTab() {
  const { authedRequest } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    authedRequest<{ prefs: Record<string, boolean> }>('/api/account/notifications').then((r) => setPrefs(r.prefs)).catch(() => {});
  }, [authedRequest]);

  async function toggle(key: string) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await authedRequest('/api/account/notifications', { method: 'PATCH', body: { [key]: next[key] } }).catch(() => {});
  }

  if (!prefs) return <Skeleton className="h-64 w-full" />;
  const groups = ['To Me', 'To Customers'] as const;

  return (
    <Card>
      {groups.map((g) => (
        <div key={g} className="mb-6 last:mb-0">
          <h3 className="mb-3 text-sm font-bold">{g}</h3>
          <div className="space-y-4">
            {PREF_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className="flex items-start gap-3">
                <Toggle on={!!prefs[f.key]} onClick={() => toggle(f.key)} />
                <div>
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-sm text-neutral-500">{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------------- Security ---------------- */
interface Session { id: string; userAgent: string; ip: string; createdAt: string; current: boolean; }
function SecurityTab() {
  const { authedRequest, logout } = useAuth();
  const router = useRouter();
  const [twoFA, setTwoFA] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    authedRequest<{ twoFactorEnabled: boolean }>('/api/account/notifications').then((r) => setTwoFA(r.twoFactorEnabled)).catch(() => setTwoFA(false));
    authedRequest<{ sessions: Session[] }>('/api/account/sessions').then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function toggle2fa() {
    const next = !twoFA;
    setTwoFA(next);
    await authedRequest('/api/account/two-factor', { method: 'POST', body: { enabled: next } }).catch(() => {});
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
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-3">
          <Toggle on={!!twoFA} onClick={toggle2fa} />
          <div>
            <div className="text-sm font-semibold">Two-Factor Verification</div>
            <div className="text-sm text-neutral-500">Add an additional layer of security to your account during login.</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Login Sessions"
          subtitle="Places where you're logged into Stan."
          action={<Button variant="outline" size="sm" onClick={revokeOthers}>Sign out other sessions</Button>}
        />
        <div className="mt-4">
          {sessions === null ? <Skeleton className="h-16 w-full" /> : sessions.length === 0 ? (
            <p className="text-sm text-neutral-500">No active sessions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr><th className="py-2 font-medium">Device</th><th className="py-2 font-medium">IP</th><th className="py-2 font-medium">When</th><th className="py-2" /></tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="py-3">{s.userAgent || 'Unknown device'}</td>
                      <td className="py-3 text-neutral-500">{s.ip || '—'}</td>
                      <td className="py-3 text-neutral-500">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="py-3 text-right">{s.current && <Badge tone="brand">Current</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="border-danger-100">
        <SectionHeading title="Request Account Deletion" subtitle="Deleting your store permanently erases all of your data and content, and can't be undone." />
        <div className="mt-4">
          {!confirmDelete ? (
            <Button variant="outline" className="text-danger-600" onClick={() => setConfirmDelete(true)}>Delete My Account</Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="danger" onClick={deleteAccount}>Yes, delete everything</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Session" />
        <div className="mt-4">
          <Button variant="secondary" onClick={async () => { await logout(); router.replace('/login'); }}>
            <IconLogout size={16} /> Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsView />;
}
