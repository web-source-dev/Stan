'use client';

import Link from 'next/link';
import { formatPrice } from '@/lib/types';

/** Links to the full product checkout page (reviews, custom fields, discounts, etc.). */
export function ProductCheckoutLink({
  username,
  slug,
  priceCents,
  currency,
  label,
  accent,
  className,
}: {
  username: string;
  slug: string;
  priceCents: number;
  currency: string;
  label: string;
  accent: string;
  className?: string;
}) {
  const href = `/${username}/product/${slug}`;
  const priceLabel = priceCents > 0 ? formatPrice(priceCents, currency) : 'Free';

  return (
    <Link
      href={href}
      className={
        className ??
        'mt-3 flex w-full min-h-[44px] items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-105 active:scale-[0.98] motion-reduce:active:scale-100'
      }
      style={{ backgroundColor: accent }}
    >
      {label || 'Buy now'} · {priceLabel}
    </Link>
  );
}
