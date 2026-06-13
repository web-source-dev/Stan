'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconX } from '@/components/icons';

/**
 * Centered modal dialog — matches Stan's "Add a contact" style sheet.
 * Locks body scroll and closes on Escape / backdrop click.
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
  size?: 'sm' | 'md' | 'lg';
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

  if (!open) return null;

  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full animate-scale-in rounded-3xl bg-white p-6 shadow-lift sm:p-7',
          maxW,
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 transition hover:bg-surface-muted hover:text-ink"
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
        {title && (
          <div className="mb-5 pr-8 text-center">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          </div>
        )}
        <div>{children}</div>
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
