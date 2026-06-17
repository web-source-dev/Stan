'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import {
  IconDownload,
  IconBook,
  IconCalendar,
  IconCheckCircle,
  IconLock,
  IconLogout,
  IconExternal,
  IconMail,
} from '@/components/icons';

interface PortalProduct {
  id: string;
  title: string;
  coverImageUrl: string;
  fileCount: number;
  downloadCount: number;
  accessToken: string;
}
interface PortalCourse {
  id: string;
  title: string;
  coverImageUrl: string;
  progress: { completed: number; total: number };
  accessToken: string;
}
interface PortalBooking {
  id: string;
  title: string;
  whenText: string;
  status: string;
  meetingUrl: string;
  manageToken: string;
  upcoming: boolean;
}
interface PortalOrder {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
}
interface Dashboard {
  email: string;
  creator: { username: string; displayName: string; avatarUrl: string } | null;
  summary: { purchases: number; spentCents: number; products: number; courses: number; bookings: number };
  products: PortalProduct[];
  courses: PortalCourse[];
  bookings: PortalBooking[];
  orders: PortalOrder[];
}

const INPUT =
  'w-full rounded-xl border border-line-strong bg-white px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

function money(cents: number, currency = 'usd') {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() });
}

function tokenKey(username: string) {
  return `cs_portal_${username.toLowerCase()}`;
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  return json;
}

export function CustomerPortal({ username }: { username: string }) {
  const [phase, setPhase] = useState<'init' | 'email' | 'code' | 'ready'>('init');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);

  const loadDashboard = useCallback(
    async (token: string) => {
      const res = await fetch(`${API_URL}/api/portal/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('session');
      return (await res.json()) as Dashboard;
    },
    [],
  );

  // Restore an existing session on mount.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(tokenKey(username)) : null;
    if (!token) {
      setPhase('email');
      return;
    }
    loadDashboard(token)
      .then((d) => {
        setData(d);
        setPhase('ready');
      })
      .catch(() => {
        localStorage.removeItem(tokenKey(username));
        setPhase('email');
      });
  }, [username, loadDashboard]);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await postJson('/api/portal/request-code', { username, email });
      setDevCode(res.devCode ?? null);
      setPhase('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await postJson('/api/portal/verify', { username, email, code });
      localStorage.setItem(tokenKey(username), res.token);
      const d = await loadDashboard(res.token);
      setData(d);
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey(username));
    setData(null);
    setCode('');
    setDevCode(null);
    setPhase('email');
  }

  /* ---------------------------------------------------------------- */
  /* Login (email → code)                                              */
  /* ---------------------------------------------------------------- */
  if (phase !== 'ready') {
    return (
      <div className="min-h-screen bg-surface-subtle">
        <div className="mx-auto flex max-w-md flex-col px-5 py-16">
          <div className="rounded-2xl border border-line bg-white p-7 shadow-soft">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconLock size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Access your purchases</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              {phase === 'code'
                ? `Enter the 6-digit code we sent to ${email}.`
                : `Sign in with the email you used at checkout to see everything you've bought from @${username}.`}
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {error}
              </div>
            )}

            {phase === 'init' ? (
              <div className="mt-6 h-12 animate-pulse rounded-xl bg-surface-subtle" />
            ) : phase === 'email' ? (
              <form onSubmit={requestCode} className="mt-6 space-y-3">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={INPUT}
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-60"
                >
                  <IconMail size={18} /> {busy ? 'Sending…' : 'Email me a code'}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="mt-6 space-y-3">
                {devCode && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Dev mode — your code is <span className="font-bold tracking-widest">{devCode}</span> (email delivery is
                    off).
                  </div>
                )}
                <input
                  inputMode="numeric"
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={`${INPUT} text-center text-xl font-bold tracking-[0.5em]`}
                />
                <button
                  type="submit"
                  disabled={busy || code.length < 4}
                  className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? 'Verifying…' : 'Verify & continue'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPhase('email'); setError(''); setCode(''); }}
                  className="w-full py-2 text-sm font-medium text-neutral-500 hover:text-ink"
                >
                  Use a different email
                </button>
              </form>
            )}
          </div>
          <Link href={`/${username}`} className="mt-6 text-center text-sm font-medium text-neutral-500 hover:text-ink">
            ← Back to @{username}
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Dashboard                                                         */
  /* ---------------------------------------------------------------- */
  const d = data!;
  const nothing = d.products.length === 0 && d.courses.length === 0 && d.bookings.length === 0;

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {d.creator?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.creator.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">
                {(d.creator?.displayName || username).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold leading-tight text-ink">{d.creator?.displayName || `@${username}`}</h1>
              <p className="text-sm text-neutral-500">{d.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-medium text-neutral-600 transition hover:text-ink"
          >
            <IconLogout size={16} /> Sign out
          </button>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Purchases" value={String(d.summary.purchases)} />
          <Stat label="Total spent" value={money(d.summary.spentCents)} />
          <Stat label="Items" value={String(d.summary.products + d.summary.courses + d.summary.bookings)} />
        </div>

        {nothing && (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white py-16 text-center">
            <h3 className="text-lg font-bold text-ink">Nothing here yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">
              Purchases you make from @{username} with this email will show up here automatically.
            </p>
            <Link
              href={`/${username}`}
              className="mt-5 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
            >
              Browse the store
            </Link>
          </div>
        )}

        {/* Products */}
        {d.products.length > 0 && (
          <Section title="Digital products" icon={<IconDownload size={18} />}>
            {d.products.map((p) => (
              <RowLink key={p.id} href={`/access/${p.accessToken}`} cover={p.coverImageUrl} title={p.title}
                sub={`${p.fileCount} file${p.fileCount === 1 ? '' : 's'}${p.downloadCount ? ` · downloaded ${p.downloadCount}×` : ''}`}
                cta="Download" />
            ))}
          </Section>
        )}

        {/* Courses */}
        {d.courses.length > 0 && (
          <Section title="Courses" icon={<IconBook size={18} />}>
            {d.courses.map((c) => {
              const pct = c.progress.total ? Math.round((c.progress.completed / c.progress.total) * 100) : 0;
              return (
                <RowLink key={c.id} href={`/learn/${c.accessToken}`} cover={c.coverImageUrl} title={c.title}
                  sub={`${c.progress.completed}/${c.progress.total} lessons · ${pct}% complete`} cta="Continue">
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </RowLink>
              );
            })}
          </Section>
        )}

        {/* Bookings */}
        {d.bookings.length > 0 && (
          <Section title="Bookings" icon={<IconCalendar size={18} />}>
            {d.bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 rounded-xl border border-line bg-white px-4 py-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <IconCalendar size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{b.title}</div>
                  <div className="text-sm text-neutral-500">
                    {b.whenText}
                    {b.status === 'pending_payment' && ' · awaiting payment'}
                    {!b.upcoming && ' · past'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {b.meetingUrl && b.upcoming && (
                    <a href={b.meetingUrl} target="_blank" rel="noreferrer"
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      Join
                    </a>
                  )}
                  <Link href={`/booking/${b.manageToken}`}
                    className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-neutral-600 hover:text-ink">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Order history */}
        {d.orders.length > 0 && (
          <Section title="Order history" icon={<IconCheckCircle size={18} />}>
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              {d.orders.map((o, i) => (
                <div key={o.id} className={`flex items-center justify-between px-4 py-3 text-sm ${i ? 'border-t border-line/70' : ''}`}>
                  <span className="text-neutral-500">
                    {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="font-semibold text-ink">{money(o.amountCents, o.currency)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Link href={`/${username}`} className="mt-8 flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-ink">
          <IconExternal size={15} /> Visit @{username}'s store
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-neutral-500">{label}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
        <span className="text-brand-600">{icon}</span> {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function RowLink({
  href, cover, title, sub, cta, children,
}: {
  href: string; cover?: string; title: string; sub: string; cta: string; children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-xl border border-line bg-white px-4 py-3.5 transition hover:border-brand-300 hover:shadow-soft">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-lg bg-surface-subtle" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">{title}</div>
        <div className="text-sm text-neutral-500">{sub}</div>
        {children}
      </div>
      <span className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
        {cta}
      </span>
    </Link>
  );
}
