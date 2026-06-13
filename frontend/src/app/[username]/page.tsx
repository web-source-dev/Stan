import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchStorefront } from '@/lib/api';
import { ApiException } from '@/lib/api';
import { BuyButton } from '@/components/BuyButton';
import { LeadCapture } from '@/components/LeadCapture';
import { StorefrontAnalytics } from '@/components/StorefrontAnalytics';
import { StoreCanvas, type SFItem, defaultStoreBlocks, hydrateBlocks } from '@/storefront';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ username: string }> };

async function load(username: string) {
  try {
    return await fetchStorefront(username);
  } catch (err) {
    if (err instanceof ApiException && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const data = await load(username);
  if (!data) return { title: 'Not found' };
  const title = data.seo?.title || `${data.profile.displayName} (@${data.profile.username})`;
  return {
    title,
    description: data.seo?.description || data.profile.bio || undefined,
    openGraph: {
      title,
      description: data.seo?.description || data.profile.bio || undefined,
      images: data.seo?.ogImageUrl ? [data.seo.ogImageUrl] : undefined,
    },
  };
}

export default async function StorefrontPage({ params }: Props) {
  const { username } = await params;
  const data = await load(username);
  if (!data) notFound();

  const { profile, theme, blocks, products, courses, bookingTypes } = data;

  const built = blocks && blocks.length ? hydrateBlocks(blocks) : defaultStoreBlocks();

  const hasOffers = products.length > 0 || courses.length > 0 || bookingTypes.length > 0;

  return (
    <>
      <StorefrontAnalytics username={profile.username} />
      <StoreCanvas
        mode="live"
        profile={profile}
        theme={theme}
        blocks={built}
        products={products as SFItem[]}
        courses={courses as SFItem[]}
        bookingTypes={bookingTypes as SFItem[]}
        hrefFor={(kind, slug) => `/${profile.username}/${kind === 'course' ? 'course' : 'book'}/${slug}`}
        buySlot={(item, a, label) => (
          <BuyButton
            username={profile.username}
            slug={item.slug}
            priceCents={item.priceCents}
            currency={item.currency}
            label={label || item.ctaLabel || 'Buy now'}
            accent={a}
          />
        )}
        emailSlot={(cfg) => (
          <div id="email-capture">
            <LeadCapture
              username={profile.username}
              accent={cfg.accent}
              heading={cfg.heading}
              buttonLabel={cfg.buttonLabel}
              dark={cfg.dark}
              ink={cfg.ink}
              sub={cfg.sub}
              cardBg={cfg.cardBg}
            />
          </div>
        )}
        emptyOffersSlot={
          !hasOffers ? (
            <div
              className="rounded-2xl border border-dashed py-12 text-center text-sm"
              style={{ borderColor: 'rgba(128,128,128,0.35)', color: 'rgba(128,128,128,0.8)' }}
            >
              This creator hasn&apos;t added any offers yet.
            </div>
          ) : undefined
        }
      />
    </>
  );
}
