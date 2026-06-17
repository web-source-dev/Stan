export type AffiliateLinkStyle = 'button' | 'callout';

export interface AffiliateLinkEditorState {
  id?: string;
  title: string;
  shortDescription: string;
  thumbnailButtonLabel: string;
  coverImageUrl: string;
  coverPublicId: string;
  thumbnailStyle: AffiliateLinkStyle;
  /** Auto-generated Stan affiliate URL — persisted as redirectUrl on the product. */
  affiliateUrl: string;
}

export const STAN_AFFILIATE_JOIN_BASE =
  process.env.NEXT_PUBLIC_STAN_AFFILIATE_JOIN_URL ?? 'https://join.stan.store';

export function buildStanAffiliateUrl(username: string): string {
  const slug = username.trim().toLowerCase();
  return slug ? `${STAN_AFFILIATE_JOIN_BASE}/${slug}` : '';
}

export function buildInitialAffiliateLink(affiliateUrl = ''): AffiliateLinkEditorState {
  return {
    title: 'Build your Stan Store',
    shortDescription: '',
    thumbnailButtonLabel: 'Click Me!',
    coverImageUrl: '',
    coverPublicId: '',
    thumbnailStyle: 'callout',
    affiliateUrl,
  };
}

export type ApiAffiliateLinkProduct = {
  id: string;
  title: string;
  shortDescription?: string;
  thumbnailButtonLabel?: string;
  coverImageUrl?: string;
  coverPublicId?: string;
  thumbnailStyle?: AffiliateLinkStyle;
  redirectUrl?: string;
  productKind?: string;
};

export function affiliateLinkFromApi(p: ApiAffiliateLinkProduct): AffiliateLinkEditorState {
  return {
    id: p.id,
    title: p.title,
    shortDescription: p.shortDescription ?? '',
    thumbnailButtonLabel: p.thumbnailButtonLabel ?? 'Click Me!',
    coverImageUrl: p.coverImageUrl ?? '',
    coverPublicId: p.coverPublicId ?? '',
    thumbnailStyle: (p.thumbnailStyle === 'button' ? 'button' : 'callout'),
    affiliateUrl: p.redirectUrl ?? '',
  };
}

export function buildAffiliateLinkBody(form: AffiliateLinkEditorState) {
  return {
    type: 'lead_magnet' as const,
    productKind: 'stan_affiliate',
    title: form.title,
    priceCents: 0,
    shortDescription: form.shortDescription,
    description: form.shortDescription || form.title,
    coverImageUrl: form.coverImageUrl,
    coverPublicId: form.coverPublicId,
    thumbnailStyle: form.thumbnailStyle,
    thumbnailButtonLabel: form.thumbnailButtonLabel,
    ctaLabel: form.thumbnailButtonLabel,
    bottomTitle: form.title,
    deliveryMode: 'url' as const,
    redirectUrl: form.affiliateUrl.trim(),
  };
}
