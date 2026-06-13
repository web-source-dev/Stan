'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { ProductEditor, type ProductEditorState } from '@/components/stan/ProductEditor';
import { useAuth } from '@/lib/auth-context';
import type { Product } from '@/lib/types';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [initial, setInitial] = useState<ProductEditorState | null>(null);
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authedRequest<{ product: Product }>(`/api/products/${id}`);
    const p = res.product;
    setInitial({
      id: p.id,
      title: p.title,
      type: p.type,
      priceDollars: (p.priceCents / 100).toString(),
      shortDescription: p.shortDescription,
      description: p.description,
      bottomTitle: p.ctaLabel || p.title,
      ctaLabel: p.ctaLabel || (p.type === 'lead_magnet' ? 'Download' : 'Buy now'),
      thankYouMessage: p.thankYouMessage ?? '',
      coverImageUrl: p.coverImageUrl,
      coverPublicId: '',
      assets: (p.assets ?? []).map((a) => ({
        publicId: a.publicId,
        resourceType: a.resourceType as 'raw',
        filename: a.filename,
        bytes: a.bytes,
        format: '',
      })),
      deliveryMode: 'file',
      redirectUrl: '',
      confirmSubject: '[Product Name] from @[My Username]',
      confirmBody: 'Thanks for signing up! Your download is ready.',
    });
  }, [authedRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initial) return null;

  return (
    <DashboardShell title="" maxWidth="max-w-[1280px]" hideSubtitle>
      <PaymentBanner />
      <ProductEditor initial={initial} onSaved={() => router.push('/dashboard/products')} />
    </DashboardShell>
  );
}
