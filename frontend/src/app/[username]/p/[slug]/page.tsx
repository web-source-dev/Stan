import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { BuyButton } from '@/components/BuyButton';
import { formatPrice } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ username: string; slug: string }> };

interface LandingResponse {
  page: { title: string; headline: string; body: string; ctaLabel: string };
  product: {
    title: string;
    slug: string;
    priceCents: number;
    currency: string;
    coverImageUrl: string;
    shortDescription?: string;
  } | null;
  creator: { displayName: string; avatarUrl: string; username: string };
}

async function load(username: string, slug: string): Promise<LandingResponse | null> {
  try {
    return await apiRequest<LandingResponse>(
      `/api/storefront/${encodeURIComponent(username)}/landing/${encodeURIComponent(slug)}`,
      { credentials: false },
    );
  } catch (err) {
    if (err instanceof ApiException && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await load(username, slug);
  if (!data) return { title: 'Not found' };
  return { title: data.page.title, description: data.page.headline || undefined };
}

export default async function LandingPage({ params }: Props) {
  const { username, slug } = await params;
  const data = await load(username, slug);
  if (!data) notFound();
  const { page, creator, product } = data;
  const accent = '#5865f2';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-5 pb-12 pt-8">
        <div className="flex items-center gap-2.5">
          {creator.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatarUrl} alt={creator.displayName} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {(creator.displayName || creator.username).charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium text-neutral-600">
            {creator.displayName || `@${creator.username}`}
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-bold leading-snug tracking-tight text-ink">{page.title}</h1>
        {page.headline && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{page.headline}</p>
        )}
        {page.body && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">{page.body}</p>
        )}

        {product ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {product.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.coverImageUrl} alt={product.title} className="aspect-[16/10] w-full object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-ink">{product.title}</h2>
                <span className="shrink-0 text-sm font-bold text-brand-600">
                  {product.priceCents ? formatPrice(product.priceCents, product.currency) : 'Free'}
                </span>
              </div>
              {product.shortDescription && (
                <p className="mt-1 text-xs text-neutral-500">{product.shortDescription}</p>
              )}
              <div className="mt-4">
                <BuyButton
                  username={creator.username}
                  slug={product.slug}
                  priceCents={product.priceCents}
                  currency={product.currency}
                  label={page.ctaLabel || 'Get access'}
                  accent={accent}
                />
              </div>
            </div>
          </div>
        ) : (
          <Link
            href={`/${creator.username}`}
            className="mt-8 flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-bold text-white shadow-soft transition hover:brightness-105"
            style={{ backgroundColor: accent }}
          >
            {page.ctaLabel || 'Get access'}
          </Link>
        )}

        <footer className="mt-14 text-center">
          <Link href="/" className="text-xs font-semibold text-neutral-400 hover:text-ink">
            Powered by Stan
          </Link>
        </footer>
      </div>
    </main>
  );
}
