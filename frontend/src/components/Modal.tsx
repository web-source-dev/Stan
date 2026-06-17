'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { IconX } from '@/components/icons';

/**
 * Centered modal dialog — matches Stan's "Add a contact" style sheet.
 *
 * Responsive: a flex column that never exceeds the viewport. The header and
 * footer stay pinned while the body scrolls. On phones it docks to the bottom
 * as a sheet; from `sm` up it floats centered. Uses dynamic viewport units so
 * mobile browser chrome doesn't clip it.
 *
 * Rendered through a portal to <body> so `position: fixed` is always relative
 * to the viewport — ancestors with a `transform`/`filter` (e.g. the dashboard's
 * `animate-fade-in` wrapper) would otherwise become its containing block and
 * push it off-screen.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex w-full animate-scale-in flex-col bg-white shadow-lift',
          'max-h-[92dvh] rounded-t-3xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl',
          maxW,
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 z-10 rounded-full p-1.5 text-neutral-400 transition hover:bg-surface-muted hover:text-ink"
          aria-label="Close"
        >
          <IconX size={18} />
        </button>

        {title && (
          <div className="shrink-0 border-b border-line/70 px-5 pb-4 pr-12 pt-5 sm:px-7 sm:pt-6">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7',
            title ? 'py-5' : 'px-5 pt-12 sm:pt-7',
            'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-line bg-white px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-7">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
