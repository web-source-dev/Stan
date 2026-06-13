'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';
import { LandingMockup } from '@/components/stan/LandingMockup';
import { IconDots, IconExternal, IconPlus, IconTrash } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface LandingPageRow {
  id: string;
  title: string;
  slug: string;
  headline?: string;
  published: boolean;
  views?: number;
}

export function LandingPagesTab({ username }: { username: string }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [pages, setPages] = useState<LandingPageRow[] | null>(null);
  const [menuId, setMenuId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await authedRequest<{ pages: LandingPageRow[] }>('/api/landing');
      setPages(res.pages);
    } catch {
      setPages([]);
    }
  }, [authedRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm('Delete this landing page?')) return;
    setError('');
    try {
      await authedRequest(`/api/landing/${id}`, { method: 'DELETE' });
      setPages((p) => (p ?? []).filter((x) => x.id !== id));
      setMenuId('');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not delete page');
    }
  }

  if (pages === null) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (pages.length === 0) {
    return (
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
            Create a Landing Page
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-neutral-500 sm:text-[15px]">
            Drive customers to an exclusive product link using a Private Landing Page! This is hidden
            from your storefront, so you can offer it to a specific group of customers.
          </p>
          <Button
            className="mt-8 rounded-xl px-5 py-3"
            onClick={() => router.push('/dashboard/landing/new')}
          >
            <IconPlus size={16} /> Create
          </Button>
        </div>
        <LandingMockup />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Landing Pages</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Private pages hidden from your storefront — share the link directly.
          </p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => router.push('/dashboard/landing/new')}>
          <IconPlus size={16} /> Create
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="space-y-3">
        {pages.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,15,25,0.06)]"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-brand-600">
              <IconExternal size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-ink">{p.title}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                    p.published ? 'bg-success-50 text-success-700' : 'bg-surface-muted text-neutral-500',
                  )}
                >
                  {p.published ? 'Live' : 'Draft'}
                </span>
              </div>
              <Link
                href={`/${username}/p/${p.slug}`}
                target="_blank"
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                /{username}/p/{p.slug}
                <IconExternal size={12} />
              </Link>
              {typeof p.views === 'number' && (
                <p className="mt-1 text-xs text-neutral-400">{p.views} views</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/landing/${p.id}/edit`)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                Edit
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuId((id) => (id === p.id ? '' : p.id))}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-surface-muted hover:text-ink"
                  aria-label="More options"
                >
                  <IconDots size={16} />
                </button>
                {menuId === p.id && (
                  <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-line bg-white p-1 shadow-lift">
                    <Link
                      href={`/${username}/p/${p.slug}`}
                      target="_blank"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-muted"
                      onClick={() => setMenuId('')}
                    >
                      <IconExternal size={14} /> Preview
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(p.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger-600 hover:bg-danger-50"
                    >
                      <IconTrash size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
