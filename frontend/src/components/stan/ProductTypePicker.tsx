'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/Modal';
import { IconArrowRight, IconBolt, IconBook, IconBox, IconCalendar, IconMagnet, IconPlay, IconSparkles, IconUsers } from '@/components/icons';

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
    body: 'Collect your audience\'s info with a lead magnet.',
    href: '/dashboard/products/new?type=lead_magnet',
  },
  {
    icon: <IconBox size={26} />,
    iconBg: 'bg-[#ffedd5] text-[#ea580c]',
    title: 'Digital Product',
    body: 'PDFs, guides, templates, exclusive content, eBooks, etc.',
    href: '/dashboard/products/new?type=digital',
  },
  {
    icon: <IconCalendar size={26} />,
    iconBg: 'bg-[#ccfbf1] text-[#0d9488]',
    title: 'Coaching Call',
    body: 'Book discovery calls, paid coaching.',
    href: '/dashboard/bookings',
  },
  {
    icon: <IconSparkles size={26} />,
    iconBg: 'bg-[#fef9c3] text-[#ca8a04]',
    title: 'Custom Product',
    body: '"Ask Me Anything" requests, audits / analyses, video reviews.',
    href: '/dashboard/products/new?type=digital',
  },
  {
    icon: <IconBook size={26} />,
    iconBg: 'bg-[#dbeafe] text-[#2563eb]',
    title: 'eCourse',
    body: 'Create, host, and sell your course within your store.',
    href: '/dashboard/courses',
  },
  {
    icon: <IconBolt size={26} />,
    iconBg: 'bg-[#ecfccb] text-[#65a30d]',
    title: 'Recurring Membership',
    body: 'Charge recurring subscriptions for ongoing access.',
    href: '/dashboard/products/new?type=digital',
  },
  {
    icon: <IconPlay size={26} />,
    iconBg: 'bg-[#f3f4f6] text-[#6b7280]',
    title: 'Webinar',
    body: 'Host exclusive sessions or online events with multiple customers.',
    href: '/dashboard/bookings',
  },
  {
    icon: <IconUsers size={26} />,
    iconBg: 'bg-[#f3e8ff] text-[#9333ea]',
    title: 'Community',
    body: 'Host a free or paid community.',
    href: '/dashboard/products/new?type=digital',
  },
];

export function ProductTypePicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Choose Product type" subtitle="Pick the format that best fits what you're selling." size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        {TYPES.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            onClick={onClose}
            className="group flex items-start gap-3.5 rounded-2xl border border-transparent bg-white p-4 shadow-[0_1px_3px_rgba(15,15,25,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(15,15,25,0.12)]"
          >
            <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl ${t.iconBg}`}>
              {t.icon}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-1 font-semibold text-ink">
                {t.title}
                <IconArrowRight size={14} className="text-neutral-300 transition group-hover:text-brand-500" />
              </div>
              <p className="mt-1 text-sm leading-snug text-neutral-500">{t.body}</p>
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}

/** Inline product-type grid (full page section). */
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
