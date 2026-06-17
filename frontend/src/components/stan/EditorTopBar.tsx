'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { IconArrowLeft, IconCheck, IconCopy } from '@/components/icons';

/**
 * Shared editor top bar — "← My Store / {title}" breadcrumb on the left and the
 * creator's "stan.store/{username}" link with a copy button on the right.
 * Matches the Stan product-editor chrome across every create/edit page.
 */
export function EditorTopBar({
  title,
  backHref = '/dashboard/storefront',
  backLabel = 'My Store',
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { authedRequest } = useAuth();
  const [handle, setHandle] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    authedRequest<{ profile: { username?: string } | null }>('/api/creator/profile')
      .then((r) => {
        if (active && r.profile?.username) setHandle(r.profile.username);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authedRequest]);

  function copy() {
    if (!handle) return;
    void navigator.clipboard?.writeText(`https://stan.store/${handle}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 font-medium text-[#8b8d98] transition hover:text-[#1a1a2e]"
        >
          <IconArrowLeft size={16} /> {backLabel}
        </Link>
        <span className="text-[#c7c9d1]">/</span>
        <span className="font-semibold text-[#1a1a2e]">{title}</span>
      </div>
      {handle && (
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6355fa] transition hover:text-[#5648e8]"
        >
          stan.store/{handle}
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        </button>
      )}
    </div>
  );
}
