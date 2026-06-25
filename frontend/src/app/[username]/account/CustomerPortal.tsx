'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  IconBag,
  IconClock,
  IconTrending,
  IconList,
  IconHome,
  IconDollar,
  IconArrowRight,
  IconBell,
} from '@/components/icons';
import {
  money,
  fmtDate,
  postJson,
  INPUT,
  OtpInput,
  Chip,
  SearchInput,
  StatusBadge,
  MiniEmpty,
  Stat,
  Section,
  RowLink,
  SpendChart,
  type MonthlyPoint,
} from '@/components/portal/ui';

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
  displayStatus?: string;
  meetingUrl: string;
  manageToken: string;
  upcoming: boolean;
}
interface PortalOrder {
  id: string;
  title: string;
  amountCents: number;
  currency: string;
  status: 'paid' | 'refunded' | string;
  provider: string;
  createdAt: string;
  refundedAt: string | null;
}
interface Dashboard {
  email: string;
  creator: { username: string; displayName: string; avatarUrl: string } | null;
  summary: {
    purchases: number;
    spentCents: number;
    refundedCents: number;
    netCents: number;
    aovCents: number;
    currency: string;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
    products: number;
    courses: number;
    bookings: number;
  };
  products: PortalProduct[];
  courses: PortalCourse[];
  bookings: PortalBooking[];
  orders: PortalOrder[];
  ordersTotal: number;
  hasMoreOrders: boolean;
  monthly: MonthlyPoint[];
}

function tokenKey(username: string) {
  return `cs_portal_${username.toLowerCase()}`;
}

export function CustomerPortal({
  username,
  initialEmail,
}: {
  username: string;
  initialEmail?: string;
}) {
  const [phase, setPhase] = useState<'init' | 'email' | 'code' | 'ready'>('init');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const didAutoRequest = useRef(false);

  const loadDashboard = useCallback(async (token: string) => {
    const res = await fetch(`${API_URL}/api/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('session');
    return (await res.json()) as Dashboard;
  }, []);

  // Restore an existing session on mount. If initialEmail is provided and there's
  // no valid session, auto-request a code so the buyer lands with email pre-filled.
  useEffect(() => {
    const token = localStorage.getItem(tokenKey(username));
    if (!token) {
      if (initialEmail && !didAutoRequest.current) {
        didAutoRequest.current = true;
        setEmail(initialEmail);
        setBusy(true);
        postJson('/api/portal/request-code', { username, email: initialEmail })
          .then((res) => {
            setDevCode(res.devCode ?? null);
            setCode('');
            setPhase('code');
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to send code');
            setPhase('email');
          })
          .finally(() => setBusy(false));
      } else {
        setPhase('email');
      }
      return;
    }
    loadDashboard(token)
      .then((d) => {
        setData(d);
        setPhase('ready');
      })
      .catch(() => {
        localStorage.removeItem(tokenKey(username));
        if (initialEmail && !didAutoRequest.current) {
          didAutoRequest.current = true;
          setEmail(initialEmail);
          setBusy(true);
          postJson('/api/portal/request-code', { username, email: initialEmail })
            .then((res) => {
              setDevCode(res.devCode ?? null);
              setCode('');
              setPhase('code');
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : 'Failed to send code');
              setPhase('email');
            })
            .finally(() => setBusy(false));
        } else {
          setPhase('email');
        }
      });
  }, [username, loadDashboard, initialEmail]);

  // Auto-submit the code once 6 digits are entered.
  useEffect(() => {
    if (phase === 'code' && code.length === 6 && !busy) void verifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await postJson('/api/portal/request-code', { username, email });
      setDevCode(res.devCode ?? null);
      setCode('');
      setPhase('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
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
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey(username));
    setData(null);
    setEmail('');
    setCode('');
    setDevCode(null);
    setError('');
    didAutoRequest.current = false;
    setPhase('email');
  }

  if (phase === 'ready' && data) {
    const token = localStorage.getItem(tokenKey(username)) ?? '';
    return <Dashboard d={data} username={username} token={token} onLogout={logout} onDataUpdate={setData} />;
  }

  /* ---------------------------------------------------------------- */
  /* Login (email → code)                                              */
  /* ---------------------------------------------------------------- */
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-subtle">
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-70" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <div className="animate-scale-in rounded-3xl border border-line bg-white/90 p-7 shadow-lift backdrop-blur-sm sm:p-8">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            {phase === 'code' ? <IconMail size={26} /> : <IconLock size={26} />}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            {phase === 'code' ? 'Check your inbox' : 'Access your purchases'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            {phase === 'code' ? (
              <>
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-ink">{email}</span>.
              </>
            ) : (
              <>
                Sign in with the email you used at checkout to see everything you&apos;ve bought
                from @{username}.
              </>
            )}
          </p>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          {phase === 'init' ? (
            <div className="mt-6 space-y-3">
              <div className="h-12 animate-pulse rounded-xl bg-surface-subtle" />
              <div className="h-12 animate-pulse rounded-xl bg-surface-subtle" />
            </div>
          ) : phase === 'email' ? (
            <form onSubmit={requestCode} className="mt-6 space-y-3">
              <input
                type="email"
                required
                autoFocus
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={INPUT}
              />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
              >
                <IconMail size={18} /> {busy ? 'Sending…' : 'Email me a code'}
              </button>
              <p className="pt-1 text-center text-xs leading-relaxed text-neutral-400">
                Passwordless &amp; secure — no account needed.
              </p>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-6 space-y-4">
              {devCode && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Dev mode — your code is{' '}
                  <button
                    type="button"
                    onClick={() => setCode(devCode)}
                    className="font-bold tracking-widest underline decoration-dotted underline-offset-2"
                  >
                    {devCode}
                  </button>{' '}
                  (email delivery is off).
                </div>
              )}
              <OtpInput value={code} onChange={setCode} disabled={busy} />
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setPhase('email');
                    setError('');
                    setCode('');
                  }}
                  className="font-medium text-neutral-500 hover:text-ink"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => requestCode()}
                  className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link
            href={`/${username}`}
            className="font-medium text-neutral-500 transition hover:text-ink"
          >
            ← Back to @{username}
          </Link>
          <span className="text-line-strong">·</span>
          <Link href="/account" className="font-medium text-neutral-500 transition hover:text-ink">
            All your stores
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Dashboard (signed-in)                                              */
/* ================================================================== */

type Tab = 'overview' | 'library' | 'orders';

function Dashboard({
  d,
  username,
  token,
  onLogout,
  onDataUpdate,
}: {
  d: Dashboard;
  username: string;
  token: string;
  onLogout: () => void;
  onDataUpdate: (d: Dashboard) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const cur = d.summary.currency || 'usd';
  const itemCount = d.summary.products + d.summary.courses + d.summary.bookings;
  const nothing = itemCount === 0 && d.orders.length === 0;
  const name = d.creator?.displayName || `@${username}`;

  return (
    <div className="min-h-screen bg-surface-subtle pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-5 sm:pt-8">
        {/* Profile header */}
        <header className="animate-fade-in relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white shadow-card sm:p-6">
          <div className="absolute inset-0 bg-aurora opacity-30" aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              {d.creator?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.creator.avatarUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-soft ring-2 ring-white/40 sm:h-[68px] sm:w-[68px]"
                />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-bold text-white ring-2 ring-white/40 sm:h-[68px] sm:w-[68px]">
                  {(d.creator?.displayName || d.creator?.username || username).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  Customer portal
                </span>
                <h1 className="truncate font-display text-xl font-bold leading-tight text-white sm:text-2xl">
                  {name}
                </h1>
                <p className="truncate text-sm text-white/80">{d.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex shrink-0 items-center gap-1.5 self-start rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <IconLogout size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Sticky tabs */}
        <div className="sticky top-3 z-20 mt-5">
          <div className="flex gap-1 rounded-2xl border border-line bg-white/85 p-1 shadow-soft backdrop-blur-md">
            <TabButton
              active={tab === 'overview'}
              onClick={() => setTab('overview')}
              icon={<IconHome size={16} />}
              label="Overview"
            />
            <TabButton
              active={tab === 'library'}
              onClick={() => setTab('library')}
              icon={<IconBag size={16} />}
              label="Library"
              count={itemCount}
            />
            <TabButton
              active={tab === 'orders'}
              onClick={() => setTab('orders')}
              icon={<IconList size={16} />}
              label="Orders"
              count={d.ordersTotal}
            />
          </div>
        </div>

        {nothing ? (
          <EmptyState username={username} />
        ) : (
          <div key={tab} className="animate-fade-in">
            {tab === 'overview' ? (
              <OverviewTab
                d={d}
                cur={cur}
                token={token}
                username={username}
                onSeeLibrary={() => setTab('library')}
                onSeeOrders={() => setTab('orders')}
                onDataUpdate={onDataUpdate}
              />
            ) : tab === 'library' ? (
              <LibraryTab d={d} />
            ) : (
              <OrdersTab d={d} cur={cur} token={token} />
            )}
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-4 text-sm">
          <Link
            href={`/${username}`}
            className="flex items-center gap-1.5 font-medium text-neutral-500 transition hover:text-ink"
          >
            <IconExternal size={15} /> Visit @{username}&apos;s store
          </Link>
          <span className="text-line-strong">·</span>
          <Link
            href="/account"
            className="flex items-center gap-1.5 font-medium text-neutral-500 transition hover:text-ink"
          >
            <IconBag size={15} /> All your stores
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ username }: { username: string }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-line-strong bg-white py-16 text-center shadow-soft">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <IconBag size={26} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-ink">Nothing here yet</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">
        Purchases you make from @{username} with this email will show up here automatically.
      </p>
      <Link
        href={`/${username}`}
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700"
      >
        Browse the store <IconArrowRight size={16} />
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Overview tab — stats + spend analytics + notification prefs       */
/* ---------------------------------------------------------------- */
function OverviewTab({
  d, cur, token, username, onSeeLibrary, onSeeOrders, onDataUpdate,
}: {
  d: Dashboard;
  cur: string;
  token: string;
  username: string;
  onSeeLibrary: () => void;
  onSeeOrders: () => void;
  onDataUpdate: (d: Dashboard) => void;
}) {
  const itemCount = d.summary.products + d.summary.courses + d.summary.bookings;
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);

  // Load notification prefs
  useEffect(() => {
    fetch(`${API_URL}/api/portal/me/prefs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setSubscribed(j.subscribed ?? true))
      .catch(() => {});
  }, [token]);

  async function toggleSubscription() {
    if (prefsBusy || subscribed === null) return;
    setPrefsBusy(true);
    const next = !subscribed;
    try {
      await fetch(`${API_URL}/api/portal/me/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscribed: next }),
      });
      setSubscribed(next);
    } catch {
      // silent — UI reflects optimistic state, reload will correct it
    } finally {
      setPrefsBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total spent" value={money(d.summary.spentCents, cur)} icon={<IconDollar size={16} />} accent />
        <Stat label="Paid orders" value={String(d.summary.purchases)} icon={<IconCheckCircle size={16} />} />
        <Stat label="Avg order" value={money(d.summary.aovCents, cur)} icon={<IconTrending size={16} />} />
        <Stat label="Items owned" value={String(itemCount)} icon={<IconBag size={16} />} />
      </div>

      {(d.summary.firstPurchaseAt || d.summary.refundedCents > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-neutral-500">
          {d.summary.firstPurchaseAt && (
            <span className="flex items-center gap-1.5">
              <IconClock size={14} className="text-neutral-400" /> Customer since{' '}
              {fmtDate(d.summary.firstPurchaseAt)}
            </span>
          )}
          {d.summary.lastPurchaseAt && (
            <span className="flex items-center gap-1.5">
              <IconCheckCircle size={14} className="text-neutral-400" /> Latest{' '}
              {fmtDate(d.summary.lastPurchaseAt)}
            </span>
          )}
          {d.summary.refundedCents > 0 && (
            <span className="font-semibold text-amber-600">
              {money(d.summary.refundedCents, cur)} refunded
            </span>
          )}
        </div>
      )}

      <SpendChart monthly={d.monthly} cur={cur} />

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickCard
          onClick={onSeeLibrary}
          icon={<IconBag size={18} />}
          title="My Library"
          sub={breakdown(d)}
        />
        <QuickCard
          onClick={onSeeOrders}
          icon={<IconList size={18} />}
          title="Orders & receipts"
          sub={`${d.ordersTotal} order${d.ordersTotal === 1 ? '' : 's'} · full history`}
        />
      </div>

      {/* Notification preferences */}
      {subscribed !== null && (
        <div className="rounded-2xl border border-line bg-white px-5 py-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <IconBell size={14} />
            </span>
            Email notifications from @{username}
          </h2>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-relaxed text-neutral-500">
              {subscribed
                ? 'You\'re subscribed to updates and newsletters from this creator.'
                : 'You\'ve unsubscribed from this creator\'s broadcast list.'}
            </p>
            <button
              onClick={toggleSubscription}
              disabled={prefsBusy}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                subscribed
                  ? 'border border-line bg-white text-neutral-600 hover:border-danger-300 hover:bg-danger-50 hover:text-danger-700'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {prefsBusy ? '…' : subscribed ? 'Unsubscribe' : 'Re-subscribe'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function breakdown(d: Dashboard) {
  const parts: string[] = [];
  if (d.summary.products) parts.push(`${d.summary.products} product${d.summary.products === 1 ? '' : 's'}`);
  if (d.summary.courses) parts.push(`${d.summary.courses} course${d.summary.courses === 1 ? '' : 's'}`);
  if (d.summary.bookings) parts.push(`${d.summary.bookings} booking${d.summary.bookings === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'Nothing yet';
}

/* ---------------------------------------------------------------- */
/* Library tab — items with type filter + search                     */
/* ---------------------------------------------------------------- */
type LibFilter = 'all' | 'products' | 'courses' | 'bookings';

function LibraryTab({ d }: { d: Dashboard }) {
  const [filter, setFilter] = useState<LibFilter>('all');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (t: string) => !needle || t.toLowerCase().includes(needle);

  const products = filter === 'all' || filter === 'products' ? d.products.filter((p) => match(p.title)) : [];
  const courses = filter === 'all' || filter === 'courses' ? d.courses.filter((c) => match(c.title)) : [];
  const bookings = filter === 'all' || filter === 'bookings' ? d.bookings.filter((b) => match(b.title)) : [];
  const empty = products.length === 0 && courses.length === 0 && bookings.length === 0;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
          <Chip active={filter === 'products'} onClick={() => setFilter('products')}>
            Products ({d.products.length})
          </Chip>
          <Chip active={filter === 'courses'} onClick={() => setFilter('courses')}>
            Courses ({d.courses.length})
          </Chip>
          <Chip active={filter === 'bookings'} onClick={() => setFilter('bookings')}>
            Bookings ({d.bookings.length})
          </Chip>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search your items…" />
      </div>

      {empty ? (
        <MiniEmpty onReset={() => { setFilter('all'); setQ(''); }} />
      ) : (
        <>
          {products.length > 0 && (
            <Section title="Digital products" icon={<IconDownload size={16} />} count={products.length}>
              {products.map((p) => (
                <RowLink
                  key={p.id}
                  href={`/access/${p.accessToken}`}
                  cover={p.coverImageUrl}
                  fallbackIcon={<IconDownload size={20} />}
                  title={p.title}
                  sub={`${p.fileCount} file${p.fileCount === 1 ? '' : 's'}${p.downloadCount ? ` · downloaded ${p.downloadCount}×` : ''}`}
                  cta="Download"
                />
              ))}
            </Section>
          )}
          {courses.length > 0 && (
            <Section title="Courses" icon={<IconBook size={16} />} count={courses.length}>
              {courses.map((c) => {
                const pct = c.progress.total
                  ? Math.round((c.progress.completed / c.progress.total) * 100)
                  : 0;
                return (
                  <RowLink
                    key={c.id}
                    href={`/learn/${c.accessToken}`}
                    cover={c.coverImageUrl}
                    fallbackIcon={<IconBook size={20} />}
                    title={c.title}
                    sub={`${c.progress.completed}/${c.progress.total} lessons · ${pct}% complete`}
                    cta={pct === 0 ? 'Start' : pct === 100 ? 'Review' : 'Continue'}
                  >
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </RowLink>
                );
              })}
            </Section>
          )}
          {bookings.length > 0 && (
            <Section title="Bookings" icon={<IconCalendar size={16} />} count={bookings.length}>
              {bookings.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

export function BookingRow({ b, store }: { b: PortalBooking; store?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-xs">
      <div
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
          b.upcoming ? 'bg-brand-50 text-brand-600' : 'bg-surface-sunken text-neutral-400'
        }`}
      >
        <IconCalendar size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">{b.title}</div>
        <div className="truncate text-sm text-neutral-500">
          {store && <span className="font-medium text-neutral-600">{store} · </span>}
          {b.whenText}
          {(b.displayStatus ?? b.status) === 'pending payment' && ' · awaiting payment'}
          {(b.displayStatus ?? b.status) === 'completed' && ' · completed'}
          {(b.displayStatus ?? b.status) === 'in progress' && ' · happening now'}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {b.meetingUrl && b.upcoming && (
          <a
            href={b.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Join
          </a>
        )}
        <Link
          href={`/booking/${b.manageToken}`}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-neutral-600 transition hover:text-ink"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Orders tab — paginated, filterable order history                  */
/* ---------------------------------------------------------------- */
type RangeKey = 'all' | '30' | '90' | '365';
type StatusKey = 'all' | 'paid' | 'refunded';
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
];

function OrdersTab({ d, cur, token }: { d: Dashboard; cur: string; token: string }) {
  const [range, setRange] = useState<RangeKey>('all');
  const [status, setStatus] = useState<StatusKey>('all');
  const [q, setQ] = useState('');
  const [allOrders, setAllOrders] = useState<PortalOrder[]>(d.orders);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = allOrders.length < d.ordersTotal;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API_URL}/api/portal/me/orders?skip=${allOrders.length}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const { orders } = await res.json() as { orders: PortalOrder[] };
      setAllOrders((prev) => [...prev, ...orders]);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000;
    return allOrders.filter((o) => {
      if (status !== 'all' && o.status !== status) return false;
      if (cutoff && new Date(o.createdAt).getTime() < cutoff) return false;
      if (needle && !o.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [allOrders, range, status, q]);

  const shownSpend = filtered.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amountCents, 0);
  const dirty = range !== 'all' || status !== 'all' || q.trim() !== '';

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <Chip active={status === 'all'} onClick={() => setStatus('all')}>All</Chip>
          <Chip active={status === 'paid'} onClick={() => setStatus('paid')}>Paid</Chip>
          <Chip active={status === 'refunded'} onClick={() => setStatus('refunded')}>Refunded</Chip>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search orders…" className="lg:w-48" />
      </div>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-neutral-500">
          {filtered.length} order{filtered.length === 1 ? '' : 's'}
          {dirty && <span className="text-neutral-400"> (filtered)</span>}
          {!dirty && d.ordersTotal > allOrders.length && (
            <span className="text-neutral-400"> of {d.ordersTotal}</span>
          )}
        </span>
        <span className="font-semibold text-ink">
          {money(shownSpend, cur)}{' '}
          <span className="font-normal text-neutral-400">paid</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <MiniEmpty
          onReset={() => { setRange('all'); setStatus('all'); setQ(''); }}
          label="No orders match these filters."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {filtered.map((o, i) => (
            <OrderRow key={o.id} o={o} divider={i > 0} />
          ))}
        </div>
      )}

      {hasMore && !dirty && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-semibold text-neutral-600 shadow-xs transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            {loadingMore ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            ) : (
              <IconArrowRight size={15} className="rotate-90" />
            )}
            {loadingMore
              ? 'Loading…'
              : `Load more (${d.ordersTotal - allOrders.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

export function OrderRow({
  o, divider, store,
}: {
  o: PortalOrder;
  divider: boolean;
  store?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-surface-subtle ${
        divider ? 'border-t border-line/70' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            o.status === 'refunded'
              ? 'bg-amber-50 text-amber-600'
              : 'bg-success-50 text-success-600'
          }`}
        >
          <IconCheckCircle size={18} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{o.title}</div>
          <div className="truncate text-xs text-neutral-500">
            {store && <span className="font-medium text-neutral-600">{store} · </span>}
            {fmtDate(o.createdAt)}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={o.status} />
        <span
          className={`w-20 text-right font-semibold tabular-nums ${
            o.status === 'refunded' ? 'text-neutral-400 line-through' : 'text-ink'
          }`}
        >
          {money(o.amountCents, o.currency)}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Local helpers                                                     */
/* ---------------------------------------------------------------- */
function TabButton({
  active, onClick, icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-brand-600 text-white shadow-soft'
          : 'text-neutral-500 hover:bg-surface-subtle hover:text-ink'
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={`rounded-full px-1.5 text-[11px] font-bold ${
            active ? 'bg-white/25' : 'bg-surface-sunken text-neutral-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function QuickCard({
  onClick, icon, title, sub,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-ink">{title}</div>
        <div className="truncate text-sm text-neutral-500">{sub}</div>
      </div>
      <IconArrowRight
        size={18}
        className="ml-auto shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"
      />
    </button>
  );
}

export type { PortalProduct, PortalCourse, PortalBooking, PortalOrder };
