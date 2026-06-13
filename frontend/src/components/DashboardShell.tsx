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
  IconBox,
  IconBook,
  IconClock,
  IconHeart,
  IconMail,
  IconStore,
  IconDollar,
  IconChart,
  IconSmile,
  IconSend,
  IconSettings,
  IconLogout,
  IconExternal,
  IconMenu,
  IconX,
  IconChevronRight,
  IconChat,
  IconCopy,
  IconCheck,
} from '@/components/icons';
import type { CreatorProfile } from '@/lib/types';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: (p: { size?: number }) => ReactNode;
  external?: boolean;
  soon?: boolean;
}

// Primary nav mirrors Stan v2's order. Items without a built page yet are marked `soon`.
const PRIMARY_NAV: NavItem[] = [
  { key: 'home', label: 'Home', href: '/dashboard', icon: IconHome },
  { key: 'store', label: 'My Store', href: '/dashboard/storefront', icon: IconStore },
  { key: 'income', label: 'Income', href: '/dashboard/orders', icon: IconDollar },
  { key: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: IconChart },
  { key: 'customers', label: 'Customers', href: '/dashboard/leads', icon: IconHeart },
  { key: 'appointments', label: 'Appointments', href: '/dashboard/bookings', icon: IconClock },
  { key: 'referrals', label: 'Referrals', href: '/dashboard/referrals', icon: IconSmile },
  { key: 'emails', label: 'Email Flows', href: '/dashboard/emails', icon: IconMail },
  { key: 'autodm', label: 'AutoDM', href: '/dashboard/autodm', icon: IconSend },
];

// "More" — extra routes that exist today but sit outside Stan's top-level nav.
const MORE_NAV: NavItem[] = [
  { key: 'products', label: 'Products', href: '/dashboard/products', icon: IconBox },
  { key: 'courses', label: 'Courses', href: '/dashboard/courses', icon: IconBook },
];

const SECONDARY_NAV: NavItem[] = [
  { key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: IconSettings },
];

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
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
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
        active
          ? 'bg-white text-ink shadow-sm ring-1 ring-line'
          : 'text-neutral-600 hover:bg-white/50 hover:text-ink',
      )}
    >
      <span className={cn(active ? 'text-brand-600' : 'text-neutral-400 group-hover:text-neutral-600')}>
        <Icon size={18} />
      </span>
      <span>{item.label}</span>
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
}: {
  profile: CreatorProfile | null;
  email?: string;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const isActive = (item: NavItem) =>
    item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={isActive(item)} onNavigate={onNavigate} />
          ))}
        </div>

        <div>
          <div className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-neutral-400">
            More
          </div>
          <div className="space-y-0.5">
            {MORE_NAV.map((item) => (
              <NavLink key={item.key} item={item} active={isActive(item)} onNavigate={onNavigate} />
            ))}
            {profile && (
              <NavLink
                item={{ key: 'view-store', label: 'View storefront', href: `/${profile.username}`, icon: IconStore, external: true }}
                active={false}
                onNavigate={onNavigate}
              />
            )}
            {SECONDARY_NAV.map((item) => (
              <NavLink key={item.key} item={item} active={isActive(item)} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar src={profile?.avatarUrl} name={profile?.displayName || email} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{profile?.displayName || 'Creator'}</div>
            <div className="truncate text-xs text-neutral-500">{email}</div>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-muted hover:text-ink"
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
      className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
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

/** Floating help bubble, bottom-right — present on every Stan admin screen. */
function HelpBubble() {
  return (
    <button
      title="Help & support"
      className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:brightness-105 active:translate-y-px"
    >
      <IconChat size={22} />
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
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  maxWidth?: string;
  hideSubtitle?: boolean;
}) {
  return (
    <RequireAuth>
      <ShellInner title={title} subtitle={subtitle} actions={actions} breadcrumb={breadcrumb} maxWidth={maxWidth} hideSubtitle={hideSubtitle}>
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
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  maxWidth: string;
  hideSubtitle?: boolean;
}) {
  const { user, logout, authedRequest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
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
  }, [load]);

  const onLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  if (!ready) return <PageLoader />;

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Desktop sidebar — light lavender tint to match Stan v2 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-[#f4f4fc] lg:block">
        <SidebarContent profile={profile} email={user?.email} pathname={pathname} onLogout={onLogout} />
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
            />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-neutral-600 hover:bg-surface-muted">
            <IconMenu size={20} />
          </button>
          <Logo />
          <div className="ml-auto"><StoreLinkBar username={profile?.username} /></div>
        </div>

        {/* Desktop store-link bar */}
        <div className="hidden h-12 items-center justify-end border-b border-line bg-white/60 px-8 backdrop-blur lg:flex">
          <StoreLinkBar username={profile?.username} />
        </div>

        <main className={cn('mx-auto px-4 py-7 sm:px-6 lg:px-8', maxWidth)}>
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

          <header className={cn('mb-7 flex flex-wrap items-start justify-between gap-4', hideSubtitle && 'mb-5')}>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
              {subtitle && !hideSubtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>

          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      <HelpBubble />
    </div>
  );
}
