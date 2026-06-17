export type LinkMediaStyle = 'button' | 'callout' | 'embed';

export interface LinkMediaEditorState {
  id?: string;
  title: string;
  shortDescription: string;
  thumbnailButtonLabel: string;
  coverImageUrl: string;
  coverPublicId: string;
  thumbnailStyle: LinkMediaStyle;
  /** Destination URL (button/callout) or embed URL (YouTube, Spotify). */
  redirectUrl: string;
}

export function buildInitialLinkMedia(): LinkMediaEditorState {
  return {
    title: 'Visit My Link',
    shortDescription: 'Tap below to check it out',
    thumbnailButtonLabel: 'Visit Link',
    coverImageUrl: '',
    coverPublicId: '',
    thumbnailStyle: 'callout',
    redirectUrl: '',
  };
}

export type ApiLinkMediaProduct = {
  id: string;
  title: string;
  shortDescription?: string;
  thumbnailButtonLabel?: string;
  coverImageUrl?: string;
  coverPublicId?: string;
  thumbnailStyle?: LinkMediaStyle;
  redirectUrl?: string;
  productKind?: string;
};

export function linkMediaFromApi(p: ApiLinkMediaProduct): LinkMediaEditorState {
  return {
    id: p.id,
    title: p.title,
    shortDescription: p.shortDescription ?? '',
    thumbnailButtonLabel: p.thumbnailButtonLabel ?? 'Visit Link',
    coverImageUrl: p.coverImageUrl ?? '',
    coverPublicId: p.coverPublicId ?? '',
    thumbnailStyle: (p.thumbnailStyle as LinkMediaStyle) ?? 'callout',
    redirectUrl: p.redirectUrl ?? '',
  };
}

export function buildLinkMediaBody(form: LinkMediaEditorState) {
  return {
    type: 'lead_magnet' as const,
    productKind: 'url_media',
    title: form.title,
    priceCents: 0,
    shortDescription: form.shortDescription,
    description: form.shortDescription,
    coverImageUrl: form.coverImageUrl,
    coverPublicId: form.coverPublicId,
    thumbnailStyle: form.thumbnailStyle,
    thumbnailButtonLabel: form.thumbnailButtonLabel,
    ctaLabel: form.thumbnailButtonLabel,
    bottomTitle: form.title,
    deliveryMode: 'url' as const,
    redirectUrl: form.redirectUrl.trim(),
  };
}
