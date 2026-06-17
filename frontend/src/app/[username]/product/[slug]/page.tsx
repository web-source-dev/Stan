import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { apiRequest, ApiException } from '@/lib/api';
import { ProductCheckoutClient, type PublicCheckoutProduct } from '@/components/ProductCheckoutClient';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ username: string; slug: string }> };

async function load(username: string, slug: string): Promise<PublicCheckoutProduct | null> {
  try {
    const res = await apiRequest<{ product: PublicCheckoutProduct }>(
      `/api/storefront/${encodeURIComponent(username)}/products/${encodeURIComponent(slug)}`,
      { credentials: false },
    );
    return res.product;
  } catch (err) {
    if (err instanceof ApiException && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const product = await load(username, slug);
  if (!product) return { title: 'Not found' };
  return { title: `${product.title} · @${username}` };
}

export default async function ProductCheckoutPage({ params }: Props) {
  const { username, slug } = await params;
  const product = await load(username, slug);
  if (!product) notFound();

  return (
    <Suspense fallback={null}>
      <ProductCheckoutClient product={product} username={username} />
    </Suspense>
  );
}
