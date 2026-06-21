'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconLock } from '@/components/icons';

/**
 * Wraps a feature in a "locked" overlay when the current plan doesn't include
 * it: the content is blurred/disabled and an "Upgrade to unlock" button links to
 * Billing. When `locked` is false it renders children untouched.
 */
export function FeatureLock({
  locked,
  label,
  compact,
  children,
}: {
  locked: boolean;
  label?: string;
  /** Smaller overlay (for inline/stat-sized areas). */
  compact?: boolean;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none opacity-40 blur-[2px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/55 p-3 text-center backdrop-blur-[1px]">
        <div className={`grid place-items-center rounded-full bg-brand-100 text-brand-600 ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}>
          <IconLock size={compact ? 14 : 18} />
        </div>
        {label && !compact && <div className="text-sm font-semibold text-[#1a1c3a]">{label}</div>}
        <Link
          href="/dashboard/settings?tab=billing"
          className={`rounded-full bg-brand-600 font-bold text-white transition hover:bg-brand-700 ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
        >
          Upgrade to unlock
        </Link>
      </div>
    </div>
  );
}
