'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { ProductEditor, EMPTY_PRODUCT, type ProductEditorState } from '@/components/stan/ProductEditor';
import { ProductTypeGrid } from '@/components/stan/ProductTypePicker';

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const [initial, setInitial] = useState<ProductEditorState | null>(null);

  useEffect(() => {
    if (typeParam === 'digital' || typeParam === 'lead_magnet') {
      setInitial({
        ...EMPTY_PRODUCT,
        type: typeParam,
        title: typeParam === 'digital' ? 'Get My Template Now!' : EMPTY_PRODUCT.title,
        ctaLabel: typeParam === 'digital' ? 'Buy now' : 'Download',
        priceDollars: typeParam === 'digital' ? '9.99' : '',
      });
    } else {
      setInitial(null);
    }
  }, [typeParam]);

  if (!typeParam) {
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
    <DashboardShell title="" maxWidth="max-w-[1280px]" hideSubtitle>
      <PaymentBanner />
      <ProductEditor initial={initial} onSaved={() => router.push('/dashboard/storefront')} />
    </DashboardShell>
  );
}
