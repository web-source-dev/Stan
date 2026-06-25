'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import {
  IconDownload,
  IconBook,
  IconCalendar,
  IconLock,
  IconLogout,
  IconMail,
  IconBag,
  IconDollar,
  IconExternal,
  IconList,
  IconStore,
  IconChevronDown,
  IconChevronRight,
  IconCheckCircle,
  IconHome,
  IconPin,
} from '@/components/icons';
import {
  money,
  fmtDate,
  postJson,
  INPUT,
  OtpInput,
  Chip,
  SearchInput,
  MiniEmpty,
  Stat,
  Section,
  RowLink,
  SpendChart,
  type MonthlyPoint,
} from '@/components/portal/ui';
import {
  BookingRow,
  OrderRow,
  type PortalProduct,
  type PortalCourse,
  type PortalBooking,
  type PortalOrder,
} from '@/app/[username]/account/CustomerPortal';

interface GStore {
  creator: { username: string; displayName: string; avatarUrl: string; published: boolean };
  summary: { purchases: number; spentCents: number; currency: string; products: number; courses: number; bookings: number };
  products: PortalProduct[];
  courses: PortalCourse[];
  bookings: PortalBooking[];
}

interface GlobalOrder extends PortalOrder {
  store: { username: string; displayName: string };
}

interface GlobalDashboard {
  email: string;
  summary: {
    stores: number;
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
  monthly: MonthlyPoint[];
  stores: GStore[];
  globalOrders: GlobalOrder[];
  globalOrdersTotal: number;
  hasMoreGlobalOrders: boolean;
}

const TOKEN_KEY = 'cs_portal_global';
const PINNED_KEY = 'cs_portal_pinned';

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function GlobalPortal({ initialEmail }: { initialEmail?: string }) {
  const [phase, setPhase] = useState<'init' | 'email' | 'code' | 'ready'>('init');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<GlobalDashboard | null>(null);
  const didAutoRequest = useRef(false);

  const load = useCallback(async (token: string) => {
    const res = await fetch(`${API_URL}/api/portal/global/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('session');
    return (await res.json()) as GlobalDashboard;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      if (initialEmail && !didAutoRequest.current) {
        didAutoRequest.current = true;
        setEmail(initialEmail);
        setBusy(true);
        postJson('/api/portal/global/request-code', { email: initialEmail })
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
    load(token)
      .then((d) => { setData(d); setPhase('ready'); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (initialEmail && !didAutoRequest.current) {
          didAutoRequest.current = true;
          setEmail(initialEmail);
          setBusy(true);
          postJson('/api/portal/global/request-code', { email: initialEmail })
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
  }, [load, initialEmail]);

  useEffect(() => {
    if (phase === 'code' && code.length === 6 && !busy) void verifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await postJson('/api/portal/global/request-code', { email });
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
      const res = await postJson('/api/portal/global/verify', { email, code });
      localStorage.setItem(TOKEN_KEY, res.token);
      const d = await load(res.token);
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
    localStorage.removeItem(TOKEN_KEY);
    setData(null);
    setEmail('');
    setCode('');
    setDevCode(null);
    setError('');
    didAutoRequest.current = false;
    setPhase('email');
  }

  if (phase === 'ready' && data) {
    const token = localStorage.getItem(TOKEN_KEY) ?? '';
    return <GlobalDashboardView d={data} token={token} onLogout={logout} />;
  }

  /* Login (email → code) */
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-subtle">
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-70" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <div className="animate-scale-in rounded-3xl border border-line bg-white/90 p-7 shadow-lift backdrop-blur-sm sm:p-8">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            {phase === 'code' ? <IconMail size={26} /> : <IconLock size={26} />}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            {phase === 'code' ? 'Check your inbox' : 'Your purchases'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            {phase === 'code' ? (
              <>
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-ink">{email}</span>.
              </>
            ) : (
              <>
                Sign in with your email to see everything you&apos;ve bought —{' '}
                across <span className="font-semibold text-ink">every store</span> on CreatorStore.
              </>
            )}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
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
                  onClick={() => { setPhase('email'); setError(''); setCode(''); }}
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
        <Link
          href="/"
          className="mt-6 text-center text-sm font-medium text-neutral-500 transition hover:text-ink"
        >
          ← Back to CreatorStore
        </Link>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Global dashboard                                                   */
/* ================================================================== */
type GTab = 'overview' | 'library' | 'orders';

function GlobalDashboardView({
  d, token, onLogout,
}: {
  d: GlobalDashboard;
  token: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<GTab>('overview');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [pinnedStores, setPinnedStores] = useState<Set<string>>(() => loadPinned());
  const cur = d.summary.currency || 'usd';
  const itemCount = d.summary.products + d.summary.courses + d.summary.bookings;

  function togglePin(username: string) {
    setPinnedStores((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  const sortedStores = useMemo(
    () =>
      [...d.stores].sort((a, b) => {
        const ap = pinnedStores.has(a.creator.username);
        const bp = pinnedStores.has(b.creator.username);
        if (ap !== bp) return ap ? -1 : 1;
        return b.summary.spentCents - a.summary.spentCents;
      }),
    [d.stores, pinnedStores],
  );

  function pickStore(username: string) {
    setStoreFilter(username);
    setTab('library');
  }

  return (
    <div className="min-h-screen bg-surface-subtle pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-5 sm:pt-8">
        {/* Header */}
        <header className="animate-fade-in relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white shadow-card sm:p-6">
          <div className="absolute inset-0 bg-aurora opacity-30" aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 ring-2 ring-white/40 sm:h-[68px] sm:w-[68px]">
                <IconBag size={30} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  Your purchases · all stores
                </span>
                <h1 className="truncate font-display text-xl font-bold leading-tight text-white sm:text-2xl">
                  {d.summary.stores} store{d.summary.stores === 1 ? '' : 's'}
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

        {d.stores.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-line-strong bg-white py-16 text-center shadow-soft">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
              <IconStore size={26} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">No purchases yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">
              Anything you buy from any CreatorStore creator with{' '}
              <span className="font-medium text-ink">{d.email}</span> will appear here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700"
            >
              Explore CreatorStore
            </Link>
          </div>
        ) : (
          <>
            {/* Sticky tabs */}
            <div className="sticky top-3 z-20 mt-5">
              <div className="flex gap-1 rounded-2xl border border-line bg-white/85 p-1 shadow-soft backdrop-blur-md">
                <GTabButton
                  active={tab === 'overview'}
                  onClick={() => setTab('overview')}
                  icon={<IconHome size={16} />}
                  label="Overview"
                />
                <GTabButton
                  active={tab === 'library'}
                  onClick={() => setTab('library')}
                  icon={<IconBag size={16} />}
                  label="Library"
                  count={itemCount}
                />
                <GTabButton
                  active={tab === 'orders'}
                  onClick={() => setTab('orders')}
                  icon={<IconList size={16} />}
                  label="Orders"
                  count={d.globalOrdersTotal}
                />
              </div>
            </div>

            <div key={tab} className="animate-fade-in">
              {tab === 'overview' ? (
                <GOverview
                  d={d}
                  cur={cur}
                  itemCount={itemCount}
                  sortedStores={sortedStores}
                  pinnedStores={pinnedStores}
                  onPickStore={pickStore}
                  onTogglePin={togglePin}
                />
              ) : tab === 'library' ? (
                <GLibrary
                  d={d}
                  storeFilter={storeFilter}
                  setStoreFilter={setStoreFilter}
                />
              ) : (
                <GOrders
                  d={d}
                  cur={cur}
                  token={token}
                  storeFilter={storeFilter}
                  setStoreFilter={setStoreFilter}
                />
              )}
            </div>
          </>
        )}

        <Link
          href="/"
          className="mt-10 flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-ink"
        >
          <IconExternal size={15} /> CreatorStore
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Overview — totals, chart, store summary cards                     */
/* ---------------------------------------------------------------- */
function GOverview({
  d, cur, itemCount, sortedStores, pinnedStores, onPickStore, onTogglePin,
}: {
  d: GlobalDashboard;
  cur: string;
  itemCount: number;
  sortedStores: GStore[];
  pinnedStores: Set<string>;
  onPickStore: (username: string) => void;
  onTogglePin: (username: string) => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total spent" value={money(d.summary.spentCents, cur)} icon={<IconDollar size={16} />} accent />
        <Stat label="Stores" value={String(d.summary.stores)} icon={<IconStore size={16} />} />
        <Stat label="Paid orders" value={String(d.summary.purchases)} icon={<IconCheckCircle size={16} />} />
        <Stat label="Items owned" value={String(itemCount)} icon={<IconBag size={16} />} />
      </div>

      {(d.summary.firstPurchaseAt || d.summary.refundedCents > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-neutral-500">
          {d.summary.firstPurchaseAt && (
            <span>Customer since {fmtDate(d.summary.firstPurchaseAt)}</span>
          )}
          {d.summary.lastPurchaseAt && (
            <span>Latest {fmtDate(d.summary.lastPurchaseAt)}</span>
          )}
          {d.summary.refundedCents > 0 && (
            <span className="font-semibold text-amber-600">
              {money(d.summary.refundedCents, cur)} refunded
            </span>
          )}
        </div>
      )}

      <SpendChart monthly={d.monthly} cur={cur} title="Spending across all stores · last 12 months" />

      <div className="space-y-3">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Your stores
          {pinnedStores.size > 0 && (
            <span className="ml-2 font-normal normal-case text-brand-600">
              · {pinnedStores.size} pinned
            </span>
          )}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedStores.map((s) => (
            <CompactStoreCard
              key={s.creator.username}
              s={s}
              pinned={pinnedStores.has(s.creator.username)}
              onOpen={() => onPickStore(s.creator.username)}
              onTogglePin={() => onTogglePin(s.creator.username)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactStoreCard({
  s, pinned, onOpen, onTogglePin,
}: {
  s: GStore;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  const cur = s.summary.currency || 'usd';
  const name = s.creator.displayName || s.creator.username || 'Store';
  const items = s.summary.products + s.summary.courses + s.summary.bookings;
  return (
    <div
      className={`group rounded-2xl border bg-white p-4 shadow-xs transition hover:shadow-card ${
        pinned ? 'border-brand-300 ring-1 ring-brand-200' : 'border-line hover:border-brand-300'
      }`}
    >
      <div className="flex items-center gap-3">
        {s.creator.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.creator.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 font-bold text-brand-700">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate font-bold text-ink">{name}</span>
            {pinned && (
              <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                Pinned
              </span>
            )}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {money(s.summary.spentCents, cur)} · {items} item{items === 1 ? '' : 's'}
          </div>
        </div>
        <button
          onClick={onTogglePin}
          title={pinned ? 'Unpin store' : 'Pin store'}
          className={`shrink-0 rounded-lg border p-2 transition ${
            pinned
              ? 'border-brand-300 bg-brand-50 text-brand-600 hover:bg-brand-100'
              : 'border-line bg-white text-neutral-400 hover:border-brand-300 hover:text-brand-600'
          }`}
        >
          <IconPin size={14} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onOpen}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-600 hover:text-white"
        >
          View items <IconChevronRight size={13} />
        </button>
        {s.creator.username && (
          <Link
            href={`/${s.creator.username}/account`}
            className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:text-ink"
          >
            Portal
          </Link>
        )}
        {s.creator.username && s.creator.published && (
          <Link
            href={`/${s.creator.username}`}
            className="grid h-[34px] w-9 place-items-center rounded-lg border border-line bg-white text-neutral-500 transition hover:text-ink"
            title="Visit store"
          >
            <IconExternal size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Library — every item across stores, filterable                    */
/* ---------------------------------------------------------------- */
type GLibFilter = 'all' | 'products' | 'courses' | 'bookings';

function GLibrary({
  d, storeFilter, setStoreFilter,
}: {
  d: GlobalDashboard;
  storeFilter: string;
  setStoreFilter: (v: string) => void;
}) {
  const [type, setType] = useState<GLibFilter>('all');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const inStore = (s: GStore) => storeFilter === 'all' || s.creator.username === storeFilter;
  const match = (t: string) => !needle || t.toLowerCase().includes(needle);

  const products = useMemo(
    () =>
      d.stores
        .filter(inStore)
        .flatMap((s) =>
          s.products.filter((p) => match(p.title)).map((p) => ({ p, store: s.creator })),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, storeFilter, needle],
  );
  const courses = useMemo(
    () =>
      d.stores
        .filter(inStore)
        .flatMap((s) =>
          s.courses.filter((c) => match(c.title)).map((c) => ({ c, store: s.creator })),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, storeFilter, needle],
  );
  const bookings = useMemo(
    () =>
      d.stores
        .filter(inStore)
        .flatMap((s) =>
          s.bookings.filter((b) => match(b.title)).map((b) => ({ b, store: s.creator })),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, storeFilter, needle],
  );

  const showP = type === 'all' || type === 'products' ? products : [];
  const showC = type === 'all' || type === 'courses' ? courses : [];
  const showB = type === 'all' || type === 'bookings' ? bookings : [];
  const empty = showP.length === 0 && showC.length === 0 && showB.length === 0;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StoreSelect stores={d.stores} value={storeFilter} onChange={setStoreFilter} />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <Chip active={type === 'all'} onClick={() => setType('all')}>All</Chip>
          <Chip active={type === 'products'} onClick={() => setType('products')}>
            Products ({products.length})
          </Chip>
          <Chip active={type === 'courses'} onClick={() => setType('courses')}>
            Courses ({courses.length})
          </Chip>
          <Chip active={type === 'bookings'} onClick={() => setType('bookings')}>
            Bookings ({bookings.length})
          </Chip>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search all items…" className="lg:w-52" />
      </div>

      {empty ? (
        <MiniEmpty onReset={() => { setType('all'); setStoreFilter('all'); setQ(''); }} />
      ) : (
        <>
          {showP.length > 0 && (
            <Section title="Digital products" icon={<IconDownload size={16} />} count={showP.length}>
              {showP.map(({ p, store }) => (
                <RowLink
                  key={p.id}
                  href={`/access/${p.accessToken}`}
                  cover={p.coverImageUrl}
                  fallbackIcon={<IconDownload size={20} />}
                  title={p.title}
                  sub={`${store.displayName || store.username} · ${p.fileCount} file${p.fileCount === 1 ? '' : 's'}${p.downloadCount ? ` · ${p.downloadCount}×` : ''}`}
                  cta="Download"
                />
              ))}
            </Section>
          )}
          {showC.length > 0 && (
            <Section title="Courses" icon={<IconBook size={16} />} count={showC.length}>
              {showC.map(({ c, store }) => {
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
                    sub={`${store.displayName || store.username} · ${c.progress.completed}/${c.progress.total} lessons · ${pct}%`}
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
          {showB.length > 0 && (
            <Section title="Bookings" icon={<IconCalendar size={16} />} count={showB.length}>
              {showB.map(({ b, store }) => (
                <BookingRow
                  key={b.id}
                  b={b}
                  store={store.displayName || store.username}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Orders — paginated flat list across stores, filterable            */
/* ---------------------------------------------------------------- */
type GRange = 'all' | '30' | '90' | '365';
type GStatus = 'all' | 'paid' | 'refunded';
const G_RANGES: { key: GRange; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
];

function GOrders({
  d, cur, token, storeFilter, setStoreFilter,
}: {
  d: GlobalDashboard;
  cur: string;
  token: string;
  storeFilter: string;
  setStoreFilter: (v: string) => void;
}) {
  const [range, setRange] = useState<GRange>('all');
  const [status, setStatus] = useState<GStatus>('all');
  const [q, setQ] = useState('');
  const [allOrders, setAllOrders] = useState<GlobalOrder[]>(d.globalOrders);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = allOrders.length < d.globalOrdersTotal;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API_URL}/api/portal/global/me/orders?skip=${allOrders.length}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const { orders } = (await res.json()) as { orders: GlobalOrder[] };
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
    return allOrders
      .filter(({ store, status: oStatus, createdAt, title }) => {
        if (storeFilter !== 'all' && store.username !== storeFilter) return false;
        if (status !== 'all' && oStatus !== status) return false;
        if (cutoff && new Date(createdAt).getTime() < cutoff) return false;
        if (needle && !title.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allOrders, storeFilter, range, status, q]);

  const shownSpend = filtered
    .filter((o) => o.status === 'paid')
    .reduce((s, o) => s + o.amountCents, 0);
  const dirty = range !== 'all' || status !== 'all' || storeFilter !== 'all' || q.trim() !== '';

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <StoreSelect stores={d.stores} value={storeFilter} onChange={setStoreFilter} />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          {G_RANGES.map((r) => (
            <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <Chip active={status === 'all'} onClick={() => setStatus('all')}>All</Chip>
          <Chip active={status === 'paid'} onClick={() => setStatus('paid')}>Paid</Chip>
          <Chip active={status === 'refunded'} onClick={() => setStatus('refunded')}>Refunded</Chip>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search orders…" />
      </div>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-neutral-500">
          {filtered.length} order{filtered.length === 1 ? '' : 's'}
          {dirty && <span className="text-neutral-400"> (filtered)</span>}
          {!dirty && d.globalOrdersTotal > allOrders.length && (
            <span className="text-neutral-400"> of {d.globalOrdersTotal}</span>
          )}
        </span>
        <span className="font-semibold text-ink">
          {money(shownSpend, cur)}{' '}
          <span className="font-normal text-neutral-400">paid</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <MiniEmpty
          onReset={() => {
            setRange('all');
            setStatus('all');
            setStoreFilter('all');
            setQ('');
          }}
          label="No orders match these filters."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {filtered.map((o, i) => (
            <OrderRow
              key={o.id}
              o={o}
              divider={i > 0}
              store={o.store.displayName || o.store.username}
            />
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
              <IconChevronDown size={15} />
            )}
            {loadingMore
              ? 'Loading…'
              : `Load more (${d.globalOrdersTotal - allOrders.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */
function GTabButton({
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
        active ? 'bg-brand-600 text-white shadow-soft' : 'text-neutral-500 hover:bg-surface-subtle hover:text-ink'
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

function StoreSelect({
  stores, value, onChange,
}: {
  stores: GStore[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-line bg-white py-1.5 pl-3.5 pr-8 text-sm font-medium text-neutral-700 outline-none transition hover:border-line-strong focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
      >
        <option value="all">All stores</option>
        {stores.map((s) => (
          <option key={s.creator.username} value={s.creator.username}>
            {s.creator.displayName || s.creator.username}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
      />
    </div>
  );
}
