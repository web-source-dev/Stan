'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { RequireAuth } from '@/components/RequireAuth';
import { Avatar, PageLoader } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  Logo,
  IconHome,
  IconClock,
  IconHeart,
  IconMail,
  IconStore,
  IconDollar,
  IconChart,
  IconSmile,
  IconSend,
  IconUsers,
  IconSettings,
  IconLogout,
  IconExternal,
  IconMenu,
  IconX,
  IconPlus,
  IconChevronRight,
  IconCopy,
  IconCheck,
  IconLock,
  IconImage,
} from '@/components/icons';
import type { CreatorProfile } from '@/lib/types';
import { getEnabledFeatures, MORE_FEATURE_KEYS, NAVPREFS_EVENT } from '@/lib/nav-prefs';
import { PLAN_CHANGED_EVENT } from '@/lib/plan-events';
import { StanleyAssistant } from '@/components/StanleyAssistant';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: (p: { size?: number }) => ReactNode;
  external?: boolean;
  soon?: boolean;
  /** Render the icon in the indigo accent (Stan does this for AutoDM). */
  accent?: boolean;
  /** Show the small indigo sparkle after the label (Stan's primary items). */
  sparkle?: boolean;
  /** Plan feature this item requires; locked (→ upgrade) when the plan lacks it. */
  requiredFeature?: 'bookings' | 'email' | 'autodm';
}

/** The plan feature flags the sidebar needs to lock gated items. */
export interface PlanFeatureFlags {
  bookings: boolean;
  email: boolean;
  autodm: boolean;
}

// Primary nav mirrors Stan v2's order. Items without a built page yet are marked `soon`.
const PRIMARY_NAV: NavItem[] = [
  { key: 'home', label: 'Home', href: '/dashboard', icon: IconHome, sparkle: true },
  { key: 'store', label: 'My Store', href: '/dashboard/storefront', icon: IconStore, sparkle: true },
  { key: 'income', label: 'Income', href: '/dashboard/orders', icon: IconDollar, sparkle: true },
  { key: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: IconChart, sparkle: true },
  { key: 'customers', label: 'Customers', href: '/dashboard/leads', icon: IconHeart, sparkle: true },
  { key: 'affiliates', label: 'Affiliates', href: '/dashboard/affiliates', icon: IconUsers, sparkle: true },
  { key: 'appointments', label: 'Appointments', href: '/dashboard/bookings', icon: IconClock, sparkle: true, requiredFeature: 'bookings' },
  { key: 'referrals', label: 'Referrals', href: '/dashboard/referrals', icon: IconSmile, sparkle: true },
  { key: 'emails', label: 'Email Flows', href: '/dashboard/emails', icon: IconMail, sparkle: true, requiredFeature: 'email' },
  { key: 'autodm', label: 'AutoDM', href: '/dashboard/autodm', icon: IconSend, accent: true, sparkle: true, requiredFeature: 'autodm' },
  { key: 'media', label: 'Media', href: '/dashboard/media', icon: IconImage, sparkle: true },
];

const SECONDARY_NAV: NavItem[] = [
  { key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: IconSettings },
];

function NavLink({ item, active, onNavigate, locked }: { item: NavItem; active: boolean; onNavigate?: () => void; locked?: boolean }) {
  const Icon = item.icon;
  if (locked) {
    return (
      <Link
        href="/dashboard/settings?tab=billing"
        onClick={onNavigate}
        title={`Upgrade your plan to unlock ${item.label}`}
        className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-medium text-neutral-400 ring-1 ring-inset ring-transparent transition-all duration-150 hover:bg-[#6355ff]/[0.06]"
      >
        <span className="text-neutral-400"><Icon size={24} /></span>
        <span className="truncate">{item.label}</span>
        <IconLock size={14} className="ml-auto shrink-0 text-neutral-400" />
      </Link>
    );
  }
  if (item.soon) {
    return (
      <span className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400">
        <Icon size={18} />
        <span>{item.label}</span>
        <span className="ml-auto rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-neutral-400">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      target={item.external ? '_blank' : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] ring-1 ring-inset transition-all duration-150',
        active
          ? 'bg-white font-bold text-[#131f60] shadow-sm ring-black/5'
          : 'font-medium text-[#131f60] ring-transparent hover:bg-[#6355ff]/[0.06] hover:text-[#6355ff] hover:ring-[#6355ff]/45',
      )}
    >
      <span
        className={cn(
          'transition-colors',
          item.accent || active ? 'text-[#6355ff]' : 'text-[#131f60] group-hover:text-[#6355ff]',
        )}
      >
        <Icon size={24} />
      </span>
      <span className="truncate">{item.label}</span>
      {item.external && <IconExternal size={14} className="ml-auto text-neutral-400" />}
    </Link>
  );
}

function SidebarContent({
  profile,
  email,
  pathname,
  onNavigate,
  onLogout,
  features,
}: {
  profile: CreatorProfile | null;
  email?: string;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  features?: PlanFeatureFlags | null;
}) {
  const isActive = (item: NavItem) =>
    item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);

  // Sidebar feature toggles (managed on the "More Options" page).
  const [enabled, setEnabled] = useState<Set<string>>(() => getEnabledFeatures());
  useEffect(() => {
    const sync = () => setEnabled(getEnabledFeatures());
    sync();
    window.addEventListener(NAVPREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(NAVPREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const visibleNav = PRIMARY_NAV.filter(
    (item) => !MORE_FEATURE_KEYS.includes(item.key as (typeof MORE_FEATURE_KEYS)[number]) || enabled.has(item.key),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {visibleNav.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={isActive(item)}
            onNavigate={onNavigate}
            locked={Boolean(item.requiredFeature && features && !features[item.requiredFeature])}
          />
        ))}
        <NavLink
          item={{ key: 'more', label: 'More', href: '/dashboard/more', icon: IconPlus }}
          active={pathname.startsWith('/dashboard/more')}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="px-3 pb-1">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={isActive(item)} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="p-3">
        <div className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white">
          <Avatar src={profile?.avatarUrl} name={profile?.username || profile?.displayName || email} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-[#131f60]">
              {profile?.username || profile?.displayName || 'Account'}
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-muted hover:text-[#131f60]"
          >
            <IconLogout size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Persistent store-link pill shown top-right on every admin screen (Stan signature). */
function StoreLinkBar({ username }: { username?: string }) {
  const [copied, setCopied] = useState(false);
  if (!username) return null;
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const url = typeof window !== 'undefined' ? `${window.location.origin}/${username}` : `/${username}`;

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={copy}
      title="Copy your store link"
      className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50"
    >
      <span className="truncate">{host ? `${host}/${username}` : `/${username}`}</span>
      {copied ? (
        <IconCheck size={15} className="text-success-600" />
      ) : (
        <IconCopy size={15} className="text-brand-400 group-hover:text-brand-600" />
      )}
    </button>
  );
}

export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
  breadcrumb,
  maxWidth = 'max-w-5xl',
  hideSubtitle = false,
  hideTitle = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  maxWidth?: string;
  hideSubtitle?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <RequireAuth>
      <ShellInner title={title} subtitle={subtitle} actions={actions} breadcrumb={breadcrumb} maxWidth={maxWidth} hideSubtitle={hideSubtitle} hideTitle={hideTitle}>
        {children}
      </ShellInner>
    </RequireAuth>
  );
}

function ShellInner({
  title,
  subtitle,
  actions,
  children,
  breadcrumb,
  maxWidth,
  hideSubtitle,
  hideTitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  maxWidth: string;
  hideSubtitle?: boolean;
  hideTitle?: boolean;
}) {
  const { user, logout, authedRequest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [features, setFeatures] = useState<PlanFeatureFlags | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile');
      if (!res.profile) {
        router.replace('/onboarding');
        return;
      }
      setProfile(res.profile);
    } catch {
      /* RequireAuth handles auth failures */
    } finally {
      setReady(true);
    }
  }, [authedRequest, router]);

  useEffect(() => {
    void load();
    // Plan features drive the sidebar locks; refetch on mount and whenever the
    // plan changes (e.g. after upgrading/downgrading on the Billing page).
    const loadFeatures = () =>
      authedRequest<{ subscription: { features: PlanFeatureFlags } }>('/api/subscription')
        .then((r) => setFeatures(r.subscription.features))
        .catch(() => setFeatures(null));
    void loadFeatures();
    window.addEventListener(PLAN_CHANGED_EVENT, loadFeatures);
    return () => window.removeEventListener(PLAN_CHANGED_EVENT, loadFeatures);
  }, [load, authedRequest]);

  // Legacy Stripe Connect return URLs pointed at /dashboard?connect=return — send
  // creators to Settings → Payments on the same origin so cookies + refresh work.
  useEffect(() => {
    if (typeof window === 'undefined' || pathname !== '/dashboard') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('connect')) return;
    const connect = params.get('connect') ?? 'return';
    router.replace(`/dashboard/settings?tab=payments&connect=${connect}`);
  }, [pathname, router]);

  const onLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  if (!ready) return <PageLoader />;

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Desktop sidebar — light lavender tint to match Stan v2 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[184px] bg-[#eeeefb] lg:block">
        <SidebarContent profile={profile} email={user?.email} pathname={pathname} onLogout={onLogout} features={features} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-fade-in bg-white shadow-lift">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-neutral-400 hover:bg-surface-muted"
            >
              <IconX size={18} />
            </button>
            <SidebarContent
              profile={profile}
              email={user?.email}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              onLogout={onLogout}
              features={features}
            />
          </div>
        </div>
      )}

      <div className="lg:pl-[184px]">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-neutral-600 hover:bg-surface-muted">
            <IconMenu size={20} />
          </button>
          <Logo />
          <div className="ml-auto"><StoreLinkBar username={profile?.username} /></div>
        </div>

        {/* Desktop top bar — page title (when the in-page header is hidden) + store link */}
        <div className="hidden h-14 items-center justify-between border-b border-line bg-white/60 px-8 backdrop-blur lg:flex">
          <div>{hideTitle && title && <h1 className="text-[22px] font-bold leading-tight tracking-tight text-[#131f60]">{title}</h1>}</div>
          <StoreLinkBar username={profile?.username} />
        </div>

        {/* Full width: main fills all space to the right of the sidebar.
            `maxWidth` is still accepted for compatibility but intentionally not applied. */}
        <main className={cn('w-full px-4 py-7 sm:px-6 lg:px-8')}>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
              {breadcrumb.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {b.href ? (
                    <Link href={b.href} className="hover:text-ink">
                      {b.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-700">{b.label}</span>
                  )}
                  {i < breadcrumb.length - 1 && <IconChevronRight size={14} className="text-neutral-300" />}
                </span>
              ))}
            </nav>
          )}

          {(title || actions) && !hideTitle && (
            <header className={cn('mb-7 flex flex-wrap items-start justify-between gap-4', hideSubtitle && 'mb-5')}>
              <div>
                {title && <h1 className="text-2xl font-bold tracking-tight text-[#1a1c3a]">{title}</h1>}
                {subtitle && !hideSubtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </header>
          )}
          {hideTitle && actions && (
            <div className="mb-5 flex justify-end">{actions}</div>
          )}

          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      <StanleyAssistant />
    </div>
  );
}
