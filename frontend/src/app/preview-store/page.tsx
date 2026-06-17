'use client';

// TEMPORARY diagnostic route — renders the storefront (StoreCanvas) with sample
// data + a chosen theme so storefront themes can be reviewed at
// /preview-store?template=<id>.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { StoreCanvas, type SFProfile, type SFItem } from '@/storefront/renderer/StoreCanvas';
import { STORE_TEMPLATES, getTemplate } from '@/storefront/templates/registry';

const img = (seed: string, size = 320) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

const SAMPLE_PROFILE: SFProfile = {
  username: 'maya',
  displayName: 'Maya Chen',
  category: 'Creator coach',
  bio: 'Templates, courses, and 1:1 coaching for creators building their first digital product.',
  avatarUrl: img('maya-avatar', 240),
  socialLinks: [
    { platform: 'instagram', url: '#' },
    { platform: 'youtube', url: '#' },
    { platform: 'x', url: '#' },
  ],
};

const SAMPLE_PRODUCTS: SFItem[] = [
  { id: 'p1', title: 'Creator Notion Starter Pack', slug: 'p1', shortDescription: 'Five plug-and-play Notion templates to run your creator business.', priceCents: 2900, currency: 'usd', coverImageUrl: img('prod-notion'), type: 'digital' },
  { id: 'p2', title: 'Launch Your First Digital Product', slug: 'p2', shortDescription: 'A step-by-step playbook from idea to first sale.', priceCents: 9900, currency: 'usd', coverImageUrl: img('prod-launch'), type: 'digital' },
];
const SAMPLE_COURSES: SFItem[] = [
  { id: 'c1', title: 'Launch in 30 Days', slug: 'c1', shortDescription: 'A guided video course.', priceCents: 9900, currency: 'usd', coverImageUrl: img('course-launch'), type: 'course' },
];
const SAMPLE_BOOKINGS: SFItem[] = [
  { id: 'b1', title: '1:1 Strategy Call', slug: 'b1', shortDescription: '45 minutes, just you and me.', priceCents: 15000, currency: 'usd', coverImageUrl: img('booking-call'), type: 'booking' },
];

function Inner() {
  const sp = useSearchParams();
  const id = sp.get('template') ?? 'studio';
  const bare = sp.get('bare') === '1';
  const tpl = getTemplate(id) ?? STORE_TEMPLATES[0];
  const blocks = tpl.build();
  const canvas = (
    <StoreCanvas
      mode="preview"
      profile={SAMPLE_PROFILE}
      theme={tpl.theme}
      blocks={blocks}
      products={SAMPLE_PRODUCTS}
      courses={SAMPLE_COURSES}
      bookingTypes={SAMPLE_BOOKINGS}
    />
  );
  // `?bare=1` renders the store content only (no phone frame) at 393px — used to
  // regenerate the carousel thumbnails in /public/stan/themes.
  if (bare) {
    return (
      <div style={{ width: 393 }} className="overflow-hidden">
        {/* eslint-disable-next-line react/no-unknown-property */}
        <style>{`nextjs-portal,#__next-build-watcher{display:none!important}`}</style>
        {canvas}
      </div>
    );
  }
  return (
    <div className="grid min-h-screen place-items-center bg-[#eceef4] p-10">
      <div>
        <p className="mb-4 text-center text-sm font-semibold text-[#131f60]">{tpl.name}</p>
        <PhoneFrame maxWidth={390}>{canvas}</PhoneFrame>
      </div>
    </div>
  );
}

export default function PreviewStorePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
