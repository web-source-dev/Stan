import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchStorefront } from '@/lib/api';
import { ApiException } from '@/lib/api';
import { ProductCheckoutLink } from '@/components/ProductCheckoutLink';
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
  const showBranding = data.showBranding !== false; // Free plan shows the Stan badge

  const built = blocks && blocks.length ? hydrateBlocks(blocks) : defaultStoreBlocks();

  const hasOffers = products.length > 0 || courses.length > 0 || bookingTypes.length > 0;

  return (
    <>
      <StorefrontAnalytics username={profile.username} />
      {/* Always-visible entry point to the buyer's self-service portal. */}
      <a
        href={`/${profile.username}/account`}
        className="fixed right-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/85 px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-soft backdrop-blur transition hover:bg-white hover:text-ink sm:right-5 sm:top-5 sm:text-sm"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        My purchases
      </a>
      <StoreCanvas
        mode="live"
        profile={profile}
        theme={theme}
        blocks={built}
        products={products as SFItem[]}
        courses={courses as SFItem[]}
        bookingTypes={bookingTypes as SFItem[]}
        hrefFor={(kind, slug) =>
          `/${profile.username}/${kind === 'course' ? 'course' : kind === 'booking' ? 'book' : 'product'}/${slug}`
        }
        buySlot={(item, a, label) => (
          <ProductCheckoutLink
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
        footerSlot={
          <div className="pt-6 text-center">
            <a
              href={`/${profile.username}/account`}
              className="text-sm font-medium underline decoration-dotted underline-offset-4 opacity-70 transition hover:opacity-100"
            >
              Already a customer? Access your purchases →
            </a>
            {showBranding && (
              <div className="mt-4">
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-xs font-semibold opacity-80 shadow-xs transition hover:opacity-100"
                >
                  ⚡ Powered by Stan
                </a>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
