'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconBolt, IconBook, IconBox, IconCalendar, IconDollar, IconLink, IconMagnet, IconPlay, IconSparkles } from '@/components/icons';
import type { ProductKind } from '@/lib/product-types';

const TYPES: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  body: string;
  href: string;
}[] = [
  {
    icon: <IconMagnet size={26} />,
    iconBg: 'bg-[#ffe4ec] text-[#e11d48]',
    title: 'Collect Emails / Applications',
    body: "Collect your audience's info with a lead magnet.",
    href: '/dashboard/products/new?kind=lead_magnet',
  },
  {
    icon: <IconBox size={26} />,
    iconBg: 'bg-[#ffedd5] text-[#ea580c]',
    title: 'Digital Product',
    body: 'PDFs, guides, templates, exclusive content, eBooks, etc.',
    href: '/dashboard/products/new?kind=digital',
  },
  {
    icon: <IconCalendar size={26} />,
    iconBg: 'bg-[#ccfbf1] text-[#0d9488]',
    title: 'Coaching Call',
    body: 'Book discovery calls, paid coaching.',
    href: '/dashboard/bookings/new',
  },
  {
    icon: <IconSparkles size={26} />,
    iconBg: 'bg-[#fef9c3] text-[#ca8a04]',
    title: 'Custom Product',
    body: '"Ask Me Anything" requests, audits / analyses, video reviews.',
    href: '/dashboard/products/new?kind=custom',
  },
  {
    icon: <IconBook size={26} />,
    iconBg: 'bg-[#dbeafe] text-[#2563eb]',
    title: 'eCourse',
    body: 'Create, host, and sell your course within your store.',
    href: '/dashboard/courses/new',
  },
  {
    icon: <IconBolt size={26} />,
    iconBg: 'bg-[#ecfccb] text-[#65a30d]',
    title: 'Recurring Membership',
    body: 'Charge recurring subscriptions for ongoing access.',
    href: '/dashboard/products/new?kind=membership',
  },
  {
    icon: <IconPlay size={26} />,
    iconBg: 'bg-[#f3f4f6] text-[#6b7280]',
    title: 'Webinar',
    body: 'Host exclusive sessions or online events with multiple customers.',
    href: '/dashboard/webinars/new',
  },
  {
    icon: <IconLink size={26} />,
    iconBg: 'bg-[#f3e8ff] text-[#9333ea]',
    title: 'URL / Media',
    body: 'Link to a Website, Affiliate Link, or even Embed Youtube and Spotify content.',
    href: '/dashboard/products/new?kind=url_media',
  },
  {
    icon: <IconDollar size={26} />,
    iconBg: 'bg-[#dbeafe] text-[#2563eb]',
    title: 'Stan Affiliate Link',
    body: 'Refer a friend and receive 20% of their Stan Subscription fee each month!',
    href: '/dashboard/products/new?kind=stan_affiliate',
  },
];

export const PRODUCT_KIND_HREFS: Record<ProductKind, string> = {
  lead_magnet: '/dashboard/products/new?kind=lead_magnet',
  digital: '/dashboard/products/new?kind=digital',
  custom: '/dashboard/products/new?kind=custom',
  membership: '/dashboard/products/new?kind=membership',
};

export const URL_MEDIA_HREF = '/dashboard/products/new?kind=url_media';
export const STAN_AFFILIATE_HREF = '/dashboard/products/new?kind=stan_affiliate';

/** Inline product-type grid for the full-page picker. */
export function ProductTypeGrid() {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-ink">Choose Product type</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Pick the format that best fits what you&apos;re selling — guides, courses, coaching, or more!
      </p>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-600"
      >
        <IconSparkles size={15} /> Get product ideas
      </button>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TYPES.map((t) => (
          <Link key={t.title} href={t.href} className="group block">
            <div className="flex h-full items-start gap-3.5 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,15,25,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(15,15,25,0.12)]">
              <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl ${t.iconBg}`}>
                {t.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 font-semibold text-ink">
                  {t.title}
                  <IconArrowRight size={14} className="text-neutral-300 group-hover:text-brand-500" />
                </div>
                <p className="mt-1 text-sm text-neutral-500">{t.body}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
