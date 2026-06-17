'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { ProductEditor, type ProductEditorState } from '@/components/stan/ProductEditor';
import { LinkMediaEditor } from '@/components/stan/LinkMediaEditor';
import { AffiliateLinkEditor } from '@/components/stan/AffiliateLinkEditor';
import { ProductTypeGrid } from '@/components/stan/ProductTypePicker';
import { buildInitialAffiliateLink } from '@/lib/affiliate-link-types';
import { buildInitialLinkMedia } from '@/lib/link-media-types';
import { buildInitialProduct, PRODUCT_KINDS } from '@/lib/product-types';

const VALID_KINDS = new Set(PRODUCT_KINDS.map((k) => k.kind));

function NewProductInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kindParam = searchParams.get('kind') ?? searchParams.get('type');
  const [initial, setInitial] = useState<ProductEditorState | null>(null);

  useEffect(() => {
    if (kindParam && VALID_KINDS.has(kindParam as typeof PRODUCT_KINDS[number]['kind'])) {
      setInitial(buildInitialProduct(kindParam));
    } else {
      setInitial(null);
    }
  }, [kindParam]);

  // Stan Affiliate Link — dedicated single-page editor.
  if (kindParam === 'stan_affiliate') {
    return (
      <DashboardShell
        title=""
        hideSubtitle
        maxWidth="max-w-[1280px]"
        breadcrumb={[{ label: 'My Store', href: '/dashboard/storefront' }, { label: 'Add Stan Affiliate Link' }]}
      >
        <PaymentBanner />
        <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
          <AffiliateLinkEditor initial={buildInitialAffiliateLink()} onSaved={() => router.push('/dashboard/storefront')} />
        </div>
      </DashboardShell>
    );
  }

  // URL / Media — dedicated single-page editor.
  if (kindParam === 'url_media') {
    return (
      <DashboardShell
        title=""
        hideSubtitle
        maxWidth="max-w-[1280px]"
        breadcrumb={[{ label: 'My Store', href: '/dashboard/storefront' }, { label: 'Add URL / Media' }]}
      >
        <PaymentBanner />
        <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
          <LinkMediaEditor initial={buildInitialLinkMedia()} onSaved={() => router.push('/dashboard/storefront')} />
        </div>
      </DashboardShell>
    );
  }

  // Step 1 — choose the product type.
  if (!kindParam || !VALID_KINDS.has(kindParam as typeof PRODUCT_KINDS[number]['kind'])) {
    return (
      <DashboardShell
        title="My Store"
        maxWidth="max-w-3xl"
        hideSubtitle
        breadcrumb={[{ label: 'My Store', href: '/dashboard/storefront' }, { label: 'Add Product' }]}
      >
        <PaymentBanner />
        <ProductTypeGrid />
      </DashboardShell>
    );
  }

  if (!initial) return null;

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'My Store', href: '/dashboard/storefront' }, { label: 'Add Product' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <ProductEditor initial={initial} onSaved={() => router.push('/dashboard/storefront')} />
      </div>
    </DashboardShell>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={null}>
      <NewProductInner />
    </Suspense>
  );
}
