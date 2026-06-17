'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { IconArrowLeft } from '@/components/icons';

/** Full-width white editor chrome — matches Stan product editor (no dashboard sidebar). */
export function ProductEditorShell({
  children,
  backHref = '/dashboard/storefront',
  backLabel = 'My Store',
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <RequireAuth>
      <div className="product-editor-page min-h-screen bg-white">
        <div className="mx-auto w-full max-w-[1320px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          <Link
            href={backHref}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#8b8d98] transition hover:text-[#1a1a2e]"
          >
            <IconArrowLeft size={16} />
            {backLabel}
          </Link>
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
