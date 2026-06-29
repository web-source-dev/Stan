import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/types';
import { BLOCK_DEFS } from '../schema/blocks';
import { HEADING_SIZE, RADIUS_CLASS, SHADOW_CLASS, TEXT_SIZE } from '../schema/tokens';
import type { Block } from '../schema/types';
import {
  btnStyleCss,
  cardSurface,
  fontStack,
  isDarkHex,
  pageBackground,
  prefersLightInkOnBg,
  resolveTheme,
  type StoreThemeInput,
} from '../runtime/theme';
import { applyItemOrder } from '../runtime/item-order';
import { SocialIcon } from './SocialIcon';

/**
 * Shared, presentational storefront renderer. No client hooks — works in the
 * public Server Component AND the dashboard builder preview, guaranteeing the
 * editor is true WYSIWYG.
 */

export interface SFItem {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  priceCents: number;
  currency: string;
  coverImageUrl?: string;
  ctaLabel?: string;
  type?: string;
}

export interface SFProfile {
  username: string;
  displayName: string;
  category: string;
  bio: string;
  avatarUrl: string;
  socialLinks: { platform: string; url: string }[];
}

export interface EmailSlotConfig {
  heading: string;
  buttonLabel: string;
  accent: string;
  dark: boolean;
  ink: string;
  sub: string;
  cardBg: string;
}

interface CanvasProps {
  profile: SFProfile;
  theme: StoreThemeInput | null;
  blocks: Block[];
  products?: SFItem[];
  courses?: SFItem[];
  bookingTypes?: SFItem[];
  webinars?: SFItem[];
  mode?: 'live' | 'preview';
  buySlot?: (item: SFItem, accent: string, label: string) => ReactNode;
  emailSlot?: (cfg: EmailSlotConfig) => ReactNode;
  hrefFor?: (kind: 'product' | 'course' | 'booking' | 'webinar', slug: string) => string;
  selectedId?: string;
  onSelectBlock?: (id: string) => void;
  footerSlot?: ReactNode;
  emptyOffersSlot?: ReactNode;
}

const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X',
  website: 'Website', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', other: 'Link',
};

function resolveFeaturedItem(cfg: Record<string, any>, digital: SFItem[], courses: SFItem[]): SFItem | undefined {
  const slug = (cfg.itemSlug as string)?.trim();
  if (slug) {
    return [...digital, ...courses].find((i) => i.slug === slug);
  }
  return digital[0] ?? courses[0];
}

function ImageArea({ url, accent, height, className = '' }: { url?: string; accent: string; height: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`w-full object-cover ${height} ${className}`} />;
  }
  return (
    <div className={`flex w-full items-center justify-center ${height} ${className}`} style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}66)` }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
        <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" />
      </svg>
    </div>
  );
}

function blockAnim(animate: boolean, motion: string): string {
  if (!animate) return '';
  const base = motion === 'expressive' ? 'animate-slide-up' : 'animate-fade-in';
  return `${base} motion-reduce:animate-none`;
}

function SectionLabel({ title, dark }: { title: string; dark: boolean }) {
  return (
    <div className="flex justify-center pb-1 pt-0.5">
      <span className={dark ? 'sf-section-pill sf-section-pill-dark' : 'sf-section-pill'}>{title}</span>
    </div>
  );
}

function ProductIcon({ accent }: { accent: string }) {
  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
      style={{ background: `${accent}18`, color: accent }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20V4h16v16H4z" opacity="0.35" />
        <path d="M4 8h16M8 4v16" />
      </svg>
    </div>
  );
}

function Thumbnail({ url, accent, size = 'md' }: { url?: string; accent: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-12 w-12' : 'h-[78px] w-[78px]';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${dim} shrink-0 rounded-2xl object-cover ring-1 ring-black/5`} />;
  }
  return (
    <div className={`grid ${dim} shrink-0 place-items-center rounded-2xl`} style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}44)` }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" />
      </svg>
    </div>
  );
}

function RatingBadge({ light }: { light?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
      style={{
        backgroundColor: light ? 'rgba(255,255,255,0.22)' : '#fef08a',
        color: light ? '#ffffff' : '#0b0b12',
      }}
    >
      ★ 5.0
    </span>
  );
}

function cardTextColors(cardBg: string | undefined, pageDark: boolean, pageInk: string, pageSub: string) {
  if (cardBg && prefersLightInkOnBg(cardBg)) {
    return { ink: '#ffffff', sub: 'rgba(255,255,255,0.78)' };
  }
  if (cardBg && !isDarkHex(cardBg)) {
    return { ink: '#0b0b12', sub: '#52525b' };
  }
  return { ink: pageInk, sub: pageSub };
}

function blockAnimStyle(idx: number, animate: boolean): CSSProperties | undefined {
  if (!animate) return undefined;
  return { animationDelay: `${Math.min(idx * 60, 420)}ms` };
}

export function StoreCanvas(props: CanvasProps) {
  const { profile, theme: themeInput, blocks, products = [], courses = [], bookingTypes = [], webinars = [], mode = 'live' } = props;
  const t = resolveTheme(themeInput);
  const pageBg = pageBackground(t.background, t.accent, t.accent2, t.backgroundStyle);
  const dark = isDarkHex(t.background);
  const ink = dark ? '#ffffff' : '#0b0b12';
  const sub = dark ? 'rgba(255,255,255,0.72)' : '#52525b';

  const header = blocks.find((b) => b.type === 'header');
  const hcfg = { ...BLOCK_DEFS.header.default, ...(header?.config ?? {}) };
  const ordered = blocks.filter((b) => b.type !== 'header');

  const digital = products.filter((p) => p.type !== 'lead_magnet');
  const leadMagnets = products.filter((p) => p.type === 'lead_magnet');

  // The live desktop page arranges all offer cards into a 2-column masonry at the
  // page level (see the live return below), so individual collection sections
  // render as a simple single-column stack — their cards then flow naturally into
  // the masonry columns. (No per-section grid; that produced lonely half-rows.)
  const liveGrid = '';

  const surface = (cfg: Record<string, any>) => cardSurface(t.cardChrome, dark, cfg.cardBg || undefined);
  const sectionAccent = (cfg: Record<string, any>) => cfg.accent || t.accent;
  const btnStyle = (cfg: Record<string, any>, accent: string) => {
    const style = cfg.ctaStyle || cfg.buttonStyle || t.buttonStyle || 'solid';
    return btnStyleCss(style, accent);
  };

  function offerButton(
    item: SFItem,
    cfg: Record<string, any>,
    accentOverride?: string,
    kind: 'product' | 'course' | 'booking' | 'webinar' = 'product',
    insideCardLink = false,
  ) {
    const a = accentOverride ?? sectionAccent(cfg);
    const label = cfg.buttonLabel || item.ctaLabel || (kind === 'booking' ? 'Book now' : kind === 'webinar' ? 'Register' : kind === 'course' ? 'View course' : 'Buy now');
    const showArrow = cfg.showArrow !== false;
    const inner = (
      <>
        {label}
        {showArrow && <span className="ml-1.5 inline-block translate-y-px" aria-hidden>→</span>}
      </>
    );
    const btnClass = `mt-3.5 flex w-full min-h-[50px] items-center justify-center rounded-full px-4 py-3.5 text-[15px] font-bold ${t.btnHoverClass} ${t.tapClass}`;
    // When the surrounding card is already a link (collection cards link to the
    // item's detail page), render a visual-only button to avoid nested anchors —
    // which is invalid HTML and was sending course/booking cards to the product
    // route (404). The parent <a> handles navigation.
    if (insideCardLink) {
      return <div className={btnClass} style={btnStyle(cfg, a)}>{inner}</div>;
    }
    if (mode === 'live') {
      // Standalone buttons (e.g. the featured block) link to the right route per
      // item kind — products go through checkout, courses/bookings to their page.
      if (kind !== 'product' && props.hrefFor) {
        return (
          <a href={props.hrefFor(kind, item.slug)} className={btnClass} style={btnStyle(cfg, a)}>
            {inner}
          </a>
        );
      }
      if (props.buySlot) return props.buySlot(item, a, label);
    }
    return (
      <div className={btnClass} style={btnStyle(cfg, a)}>
        {inner}
      </div>
    );
  }

  function selectable(b: Block, node: ReactNode, idx: number) {
    const anim = blockAnim(t.animateBlocks, t.motion);
    const animStyle = blockAnimStyle(idx, t.animateBlocks);
    const wrapped = (
      <div className={anim} style={animStyle}>
        {node}
      </div>
    );
    if (!props.onSelectBlock) {
      if (b.visible === false) {
        return (
          <div key={b.id} className="relative">
            <div className="absolute right-1 top-1 z-10 rounded-full bg-neutral-800/80 px-2 py-0.5 text-2xs font-medium text-white">Hidden</div>
            <div className="opacity-40">{wrapped}</div>
          </div>
        );
      }
      return <div key={b.id}>{wrapped}</div>;
    }
    const selected = props.selectedId === b.id;
    return (
      <div
        key={b.id}
        onClick={(e) => { e.stopPropagation(); props.onSelectBlock!(b.id); }}
        className={`relative cursor-pointer rounded-xl transition ${selected ? 'outline outline-2 outline-offset-2 outline-brand-500' : 'hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-brand-300'}`}
      >
        {b.visible === false && (
          <div className="absolute right-1 top-1 z-10 rounded-full bg-neutral-800/80 px-2 py-0.5 text-2xs font-medium text-white">Hidden</div>
        )}
        <div className={b.visible === false ? 'opacity-40' : ''}>{wrapped}</div>
      </div>
    );
  }

  function collection(b: Block, items: SFItem[], kind: 'product' | 'course' | 'booking' | 'webinar') {
    if (items.length === 0) return null;
    const cfg = b.config;
    const sorted = applyItemOrder(items, cfg.itemOrder);
    const start = Number(cfg.startIndex ?? 0);
    const max = cfg.maxItems != null ? Number(cfg.maxItems) : undefined;
    const visible = sorted.slice(start, max != null ? start + max : undefined);
    if (visible.length === 0) return null;
    const layout = cfg.layout || 'card';
    const grid = layout === 'grid';
    const list = layout === 'list';
    const horizontal = layout === 'horizontal';
    const horizontalCompact = layout === 'horizontal-compact';
    const a = sectionAccent(cfg);
    const s = surface(cfg);
    const radius = RADIUS_CLASS[cfg.cardRadius] || 'rounded-2xl';
    const shadow = cfg.shadow ? (SHADOW_CLASS[cfg.shadow] ?? '') : (t.cardChrome === 'elevated' ? 'shadow-soft' : '');
    const cardInk = cardTextColors(cfg.cardBg || undefined, dark, ink, sub);
    const ratingLight = Boolean(cfg.cardBg && prefersLightInkOnBg(cfg.cardBg));

    if (horizontalCompact) {
      return (
        <section className={t.innerGap}>
          {cfg.title && mode !== 'live' && <SectionLabel title={cfg.title} dark={dark} />}
          <div className={`${t.innerGap}${liveGrid}`}>
            {visible.map((item) => {
              const inner = (
                <div
                  className={`flex items-center gap-3.5 p-5 ${radius} ${shadow || 'shadow-soft'} ${s.className} ${t.cardHoverClass} ${t.tapClass}`}
                  style={{ backgroundColor: s.backgroundColor, borderColor: s.borderColor, borderWidth: 1, borderStyle: 'solid' }}
                >
                  {cfg.showImage && <Thumbnail url={item.coverImageUrl} accent={a} size="sm" />}
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-[17px] font-bold leading-snug" style={{ color: cardInk.ink }}>{item.title}</h3>
                    {(cfg.showPrice || cfg.showRating) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {cfg.showPrice && (
                          <span className="text-sm font-bold" style={{ color: cardInk.ink }}>
                            {item.priceCents ? formatPrice(item.priceCents, item.currency) : 'Free'}
                          </span>
                        )}
                        {cfg.showRating && <RatingBadge light={ratingLight} />}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-lg font-light" style={{ color: cardInk.ink === '#ffffff' ? '#ffffff' : a }} aria-hidden>›</span>
                </div>
              );
              if (mode === 'live' && props.hrefFor) {
                return <a key={item.id} href={props.hrefFor(kind, item.slug)} className="block">{inner}</a>;
              }
              return <div key={item.id}>{inner}</div>;
            })}
          </div>
        </section>
      );
    }

    if (horizontal) {
      return (
        <section className={t.innerGap}>
          {cfg.title && mode !== 'live' && <SectionLabel title={cfg.title} dark={dark} />}
          <div className={`${t.innerGap}${liveGrid}`}>
            {visible.map((item) => {
              const inner = (
                <div
                  className={`overflow-hidden p-5 ${radius} ${shadow || 'shadow-soft'} ${s.className} ${t.cardHoverClass} ${t.tapClass}`}
                  style={{ backgroundColor: s.backgroundColor, borderColor: s.borderColor, borderWidth: 1, borderStyle: 'solid' }}
                >
                  <div className="flex gap-3">
                    {cfg.showImage && <Thumbnail url={item.coverImageUrl} accent={a} />}
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="text-[17px] font-bold leading-snug" style={{ color: cardInk.ink }}>{item.title}</h3>
                      {cfg.showDescription && item.shortDescription && (
                        <p className="mt-1 line-clamp-2 text-sm leading-snug" style={{ color: cardInk.sub }}>{item.shortDescription}</p>
                      )}
                      {(cfg.showPrice || cfg.showRating) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {cfg.showPrice && (
                            <span className="text-sm font-bold" style={{ color: cardInk.ink }}>
                              {item.priceCents ? formatPrice(item.priceCents, item.currency) : 'Free'}
                            </span>
                          )}
                          {cfg.showRating && <RatingBadge light={ratingLight} />}
                        </div>
                      )}
                    </div>
                  </div>
                  {offerButton(item, cfg, cfg.ctaStyle === 'inverse' ? undefined : a, kind, mode === 'live' && kind !== 'product')}
                </div>
              );
              if (mode === 'live' && kind !== 'product' && props.hrefFor) {
                return <a key={item.id} href={props.hrefFor(kind, item.slug)} className="block">{inner}</a>;
              }
              return <div key={item.id}>{inner}</div>;
            })}
          </div>
        </section>
      );
    }

    if (list) {
      return (
        <section className={t.innerGap}>
          {cfg.title && mode !== 'live' && <SectionLabel title={cfg.title} dark={dark} />}
          <div className={`overflow-hidden rounded-2xl border ${t.cardHoverClass}`} style={{ borderColor: s.borderColor, backgroundColor: s.backgroundColor }}>
            {visible.map((item, i) => {
              const row = (
                <div
                  className={`flex min-h-[56px] items-center gap-3 px-4 py-3.5 ${t.tapClass} ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: s.borderColor }}
                >
                  {cfg.showImage ? (
                    item.coverImageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.coverImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
                      : <ProductIcon accent={a} />
                  ) : (
                    <ProductIcon accent={a} />
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug" style={{ color: ink }}>{item.title}</h3>
                    </div>
                    {(cfg.showPrice || cfg.showRating) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {cfg.showPrice && (
                          <span className="text-sm font-bold" style={{ color: a }}>
                            {item.priceCents ? formatPrice(item.priceCents, item.currency) : 'Free'}
                          </span>
                        )}
                        {cfg.showRating && <RatingBadge />}
                      </div>
                    )}
                    {cfg.showDescription && item.shortDescription && (
                      <p className="mt-0.5 line-clamp-2 text-sm leading-snug" style={{ color: sub }}>{item.shortDescription}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-lg font-light" style={{ color: a }} aria-hidden>›</span>
                </div>
              );
              if (mode === 'live' && props.hrefFor) {
                return <a key={item.id} href={props.hrefFor(kind, item.slug)} className="block">{row}</a>;
              }
              return <div key={item.id}>{row}</div>;
            })}
          </div>
        </section>
      );
    }

    return (
      <section className={t.innerGap}>
        {cfg.title && mode !== 'live' && <SectionLabel title={cfg.title} dark={dark} />}
        <div className={grid ? 'grid grid-cols-1 gap-3 min-[380px]:grid-cols-2' : `${t.innerGap}${liveGrid}`}>
          {visible.map((item) => {
            const inner = (
              <div
                className={`overflow-hidden ${radius} ${shadow || 'shadow-soft'} ${s.className} ${t.cardHoverClass} ${t.tapClass}`}
                style={{ backgroundColor: s.backgroundColor, borderColor: s.borderColor, borderWidth: 1, borderStyle: 'solid' }}
              >
                {cfg.showImage && (
                  <div className="relative">
                    <ImageArea url={item.coverImageUrl} accent={a} height={grid ? 'h-28' : 'h-40'} />
                    {!item.coverImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ProductIcon accent={a} />
                      </div>
                    )}
                  </div>
                )}
                <div className="p-4 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug" style={{ color: ink }}>{item.title}</h3>
                    {cfg.showPrice && (
                      <span className="shrink-0 text-sm font-bold" style={{ color: a }}>
                        {item.priceCents ? formatPrice(item.priceCents, item.currency) : 'Free'}
                      </span>
                    )}
                  </div>
                  {cfg.showDescription && item.shortDescription && (
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: sub }}>{item.shortDescription}</p>
                  )}
                  {offerButton(item, cfg, undefined, kind, mode === 'live' && kind !== 'product')}
                </div>
              </div>
            );
            if (mode === 'live' && kind !== 'product' && props.hrefFor) {
              return <a key={item.id} href={props.hrefFor(kind, item.slug)} className="block">{inner}</a>;
            }
            return <div key={item.id}>{inner}</div>;
          })}
        </div>
      </section>
    );
  }

  function renderBlock(b: Block): ReactNode {
    const cfg = b.config;
    switch (b.type) {
      case 'featured': {
        const item = resolveFeaturedItem(cfg, digital, courses);
        if (!item) return null;
        const featuredKind: 'product' | 'course' = courses.some((c) => c.id === item.id) ? 'course' : 'product';
        const a = cfg.accent || t.accent;
        const s = surface(cfg);
        return (
          <div
            className={`overflow-hidden ${RADIUS_CLASS[cfg.cardRadius] || 'rounded-3xl'} ${SHADOW_CLASS[cfg.shadow] ?? 'shadow-lift'} ${s.className} ${t.cardHoverClass} ${t.tapClass}`}
            style={{ backgroundColor: s.backgroundColor, borderColor: s.borderColor, borderWidth: 1, borderStyle: 'solid' }}
          >
            <div className="relative">
              <ImageArea url={item.coverImageUrl} accent={a} height="h-44" />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                style={{ background: `linear-gradient(to top, ${s.backgroundColor}, transparent)` }}
              />
            </div>
            <div className="p-5 text-left">
              <span
                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-xs"
                style={{ backgroundColor: a }}
              >
                ★ {cfg.headline || 'Start here'}
              </span>
              <h3 className="mt-3 text-lg font-bold leading-snug" style={{ color: ink }}>{item.title}</h3>
              {item.shortDescription && (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: sub }}>{item.shortDescription}</p>
              )}
              {offerButton(item, cfg, undefined, featuredKind)}
            </div>
          </div>
        );
      }
      case 'product': return collection(b, digital, 'product');
      case 'course': return collection(b, courses, 'course');
      case 'booking': return collection(b, bookingTypes, 'booking');
      case 'webinar': return collection(b, webinars, 'webinar');
      case 'leadMagnet':
        return collection({ ...b, config: { ...cfg, buttonStyle: cfg.buttonStyle || 'soft' } }, leadMagnets, 'product');
      case 'links': {
        if (profile.socialLinks.length === 0) return null;
        const pills = cfg.layout === 'pills';
        if (pills) {
          return (
            <div className="flex flex-wrap justify-center gap-2">
              {profile.socialLinks.map((l, i) => (
                <a
                  key={i}
                  href={mode === 'live' ? l.url : undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`sf-link-pill inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-xs ${t.tapClass}`}
                  style={{
                    backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#ffffff',
                    color: ink,
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : '#eaeaf0'}`,
                  }}
                >
                  <SocialIcon platform={l.platform} size={15} />
                  {SOCIAL_LABEL[l.platform] ?? l.platform}
                </a>
              ))}
            </div>
          );
        }
        return (
          <div className="overflow-hidden rounded-2xl border shadow-soft" style={{ borderColor: dark ? 'rgba(255,255,255,0.12)' : '#eaeaf0' }}>
            {profile.socialLinks.map((l, i) => (
              <a
                key={i}
                href={mode === 'live' ? l.url : undefined}
                target="_blank"
                rel="noreferrer noopener"
                className={`sf-link-row flex min-h-[52px] items-center gap-3 px-5 py-3.5 text-sm font-semibold ${t.tapClass} ${i > 0 ? 'border-t' : ''}`}
                style={{
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  color: ink,
                  borderColor: dark ? 'rgba(255,255,255,0.12)' : '#eaeaf0',
                }}
              >
                <SocialIcon platform={l.platform} size={18} />
                {SOCIAL_LABEL[l.platform] ?? l.platform}
                <span className="ml-auto" style={{ color: t.accent }} aria-hidden>›</span>
              </a>
            ))}
          </div>
        );
      }
      case 'emailCapture': {
        const a = cfg.accent || t.accent;
        const s = surface(cfg);
        const emailCfg: EmailSlotConfig = {
          heading: cfg.heading || 'Stay in the loop',
          buttonLabel: cfg.buttonLabel || 'Subscribe',
          accent: a,
          dark,
          ink,
          sub,
          cardBg: cfg.bg || s.backgroundColor,
        };
        if (mode === 'live' && props.emailSlot) return props.emailSlot(emailCfg);
        return (
          <div
            className={`rounded-2xl p-5 text-center ${s.className}`}
            style={{ backgroundColor: emailCfg.cardBg, border: `1px solid ${s.borderColor}` }}
          >
            <div className="font-semibold" style={{ color: ink }}>{emailCfg.heading}</div>
            <div className="mx-auto mt-3 h-11 rounded-xl" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#f5f5f8' }} />
            <div className="mt-2 min-h-[46px] rounded-xl py-3 text-sm font-bold" style={btnStyleCss('solid', a)}>
              {emailCfg.buttonLabel}
            </div>
          </div>
        );
      }
      case 'heading':
        return (
          <h2
            className={`font-bold tracking-tight ${HEADING_SIZE[cfg.size] || 'text-2xl'} ${cfg.align === 'left' ? 'text-left' : cfg.align === 'right' ? 'text-right' : 'text-center'}`}
            style={{ color: cfg.color || ink }}
          >
            {cfg.text}
          </h2>
        );
      case 'text':
        return (
          <p
            className={`leading-relaxed ${TEXT_SIZE[cfg.size] || 'text-base'} ${cfg.align === 'left' ? 'text-left' : cfg.align === 'right' ? 'text-right' : 'text-center'}`}
            style={{ color: cfg.color || sub }}
          >
            {cfg.text}
          </p>
        );
      case 'button': {
        const a = cfg.bg || t.accent;
        const style: CSSProperties = cfg.buttonStyle === 'outline'
          ? { color: cfg.color || a, border: `2px solid ${a}`, background: 'transparent' }
          : cfg.buttonStyle === 'soft'
            ? { color: cfg.color || a, background: `${a}22` }
            : { background: a, color: cfg.color || '#fff' };
        const wrap = cfg.align === 'left' ? 'justify-start' : cfg.align === 'right' ? 'justify-end' : 'justify-center';
        return (
          <div className={`flex ${wrap}`}>
            <a
              href={mode === 'live' && cfg.url ? cfg.url : undefined}
              target="_blank"
              rel="noreferrer noopener"
              className={`min-h-[44px] ${cfg.fullWidth ? 'w-full text-center' : ''} ${cfg.radius === 'lg' ? 'rounded-xl' : 'rounded-full'} px-6 py-3 text-sm font-bold ${t.tapClass}`}
              style={style}
            >
              {cfg.label || 'Button'}
            </a>
          </div>
        );
      }
      case 'image':
        if (!cfg.url) {
          return mode === 'preview'
            ? <div className="grid h-32 place-items-center rounded-2xl border border-dashed text-xs" style={{ borderColor: dark ? 'rgba(255,255,255,0.2)' : '#dcdce4', color: sub }}>Add an image URL</div>
            : null;
        }
        return (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.url} alt={cfg.caption || ''} className={`${cfg.fullWidth ? 'w-full' : 'mx-auto'} ${RADIUS_CLASS[cfg.radius] || 'rounded-2xl'} ${cfg.radius === 'full' ? 'aspect-square w-40 object-cover' : ''}`} />
            {cfg.caption && <figcaption className="mt-2 text-center text-xs" style={{ color: sub }}>{cfg.caption}</figcaption>}
          </figure>
        );
      case 'divider':
        if (cfg.style === 'space') return <div className="h-6" />;
        if (cfg.style === 'dots') {
          return (
            <div className="flex justify-center gap-1.5 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.3)' : '#dcdce4' }} />
              ))}
            </div>
          );
        }
        return <hr style={{ borderColor: dark ? 'rgba(255,255,255,0.14)' : '#eaeaf0' }} />;
      case 'hero': {
        const a = cfg.accent || t.accent;
        const alignText = cfg.align === 'left' ? 'text-left items-start' : cfg.align === 'right' ? 'text-right items-end' : 'text-center items-center';
        const btnWrap = cfg.align === 'left' ? 'justify-start' : cfg.align === 'right' ? 'justify-end' : 'justify-center';
        const s = surface(cfg);
        return (
          <div className={`overflow-hidden rounded-3xl shadow-lift ${s.className}`} style={{ backgroundColor: cfg.bg || s.backgroundColor, border: `1px solid ${s.borderColor}` }}>
            {cfg.imageUrl ? <ImageArea url={cfg.imageUrl} accent={a} height="h-40" /> : <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${a}, ${a}88)` }} />}
            <div className={`flex flex-col gap-2 p-6 ${alignText}`}>
              <h2 className="text-xl font-extrabold tracking-tight" style={{ color: ink }}>{cfg.headline || 'Build something people love'}</h2>
              {cfg.subheadline && <p className="text-sm leading-relaxed" style={{ color: sub }}>{cfg.subheadline}</p>}
              {cfg.ctaLabel && (
                <div className={`mt-2 flex ${btnWrap}`}>
                  <a
                    href={mode === 'live' && cfg.ctaUrl ? cfg.ctaUrl : undefined}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`min-h-[46px] rounded-xl px-5 py-3 text-sm font-bold ${t.btnHoverClass} ${t.tapClass}`}
                    style={btnStyleCss(t.buttonStyle, a)}
                  >
                    {cfg.ctaLabel}
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      }
      case 'testimonial': {
        const a = cfg.accent || t.accent;
        const s = surface(cfg);
        return (
          <figure className={`rounded-2xl p-5 ${s.className}`} style={{ backgroundColor: s.backgroundColor, border: `1px solid ${s.borderColor}` }}>
            <div className="text-3xl leading-none" style={{ color: a }}>&ldquo;</div>
            <blockquote className="-mt-2 text-sm leading-relaxed" style={{ color: ink }}>{cfg.quote}</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {cfg.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={cfg.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                : <div className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: a }}>{(cfg.author || '?').charAt(0).toUpperCase()}</div>}
              <div className="text-left">
                <div className="text-sm font-semibold" style={{ color: ink }}>{cfg.author || 'Happy customer'}</div>
                {cfg.role && <div className="text-xs" style={{ color: sub }}>{cfg.role}</div>}
              </div>
            </figcaption>
          </figure>
        );
      }
      case 'faq': {
        const items: { q?: string; a?: string }[] = Array.isArray(cfg.items) ? cfg.items : [];
        if (items.length === 0) return null;
        const s = surface(cfg);
        return (
          <section className={t.innerGap}>
            {cfg.title && mode !== 'live' && <SectionLabel title={cfg.title} dark={dark} />}
            <div className={t.innerGap}>
              {items.map((it, i) => (
                <details
                  key={i}
                  className={`group rounded-2xl px-4 py-3 ${s.className}`}
                  style={{ backgroundColor: s.backgroundColor, border: `1px solid ${s.borderColor}` }}
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold" style={{ color: ink }}>
                    {it.q || 'Question'}
                    <span className="shrink-0 transition duration-200 group-open:rotate-45" style={{ color: t.accent }}>+</span>
                  </summary>
                  {it.a && <p className="mt-2 pb-1 text-sm leading-relaxed" style={{ color: sub }}>{it.a}</p>}
                </details>
              ))}
            </div>
          </section>
        );
      }
      case 'gallery': {
        const images: { url?: string; link?: string }[] = (Array.isArray(cfg.images) ? cfg.images : []).filter((im: any) => im?.url || mode === 'preview');
        if (images.length === 0) return null;
        const radius = RADIUS_CLASS[cfg.cardRadius] || 'rounded-2xl';
        return (
          <section className={t.innerGap}>
            {cfg.title && mode !== 'live' && <SectionLabel title={cfg.title} dark={dark} />}
            <div className="grid grid-cols-2 gap-2.5">
              {images.map((im, i) => {
                const tile = im.url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={im.url} alt="" className={`aspect-square w-full object-cover ${radius} ${t.tapClass}`} />
                  : <div className={`grid aspect-square w-full place-items-center text-xs ${radius}`} style={{ background: `linear-gradient(135deg, ${t.accent}26, ${t.accent}66)`, color: sub }}>Image</div>;
                if (mode === 'live' && im.link) {
                  return <a key={i} href={im.link} target="_blank" rel="noreferrer noopener" className="block">{tile}</a>;
                }
                return <div key={i}>{tile}</div>;
              })}
            </div>
          </section>
        );
      }
      default:
        return null;
    }
  }

  const avatarRadius = hcfg.avatarShape === 'square' ? 'rounded-2xl' : hcfg.avatarShape === 'rounded' ? 'rounded-3xl' : 'rounded-full';
  const headerAlign = hcfg.align === 'left' ? 'items-start text-left' : 'items-center text-center';
  const bannerColor = hcfg.bannerColor || t.accent;
  const bannerColor2 = hcfg.bannerColor ? bannerColor : t.accent2;
  const layout = hcfg.profileLayout || 'stacked';
  const socialStyle = hcfg.socialStyle || 'pills';
  const showAvatar = hcfg.showAvatar !== false;
  const inlineHeader = layout === 'inline';
  const avatarSize = inlineHeader ? Math.min(hcfg.avatarSize, 72) : hcfg.avatarSize;
  const nameClass = hcfg.nameItalic ? 'italic' : '';

  function renderSocials(center = false) {
    if (!hcfg.showSocials || profile.socialLinks.length === 0) return null;
    const justify = center || hcfg.align === 'center' ? 'justify-center' : 'justify-start';
    if (socialStyle === 'icons') {
      return (
        <div className={`flex flex-wrap gap-2.5 ${justify}`}>
          {profile.socialLinks.map((l, i) => (
            <a
              key={i}
              href={mode === 'live' ? l.url : undefined}
              target="_blank"
              rel="noreferrer noopener"
              className={`grid h-10 w-10 place-items-center rounded-xl ${t.tapClass}`}
              style={{
                backgroundColor: layout === 'split' || layout === 'hero' || dark ? 'rgba(255,255,255,0.16)' : '#f1f1f5',
                color: layout === 'split' || layout === 'hero' || dark ? '#ffffff' : '#6b7280',
              }}
              aria-label={SOCIAL_LABEL[l.platform] ?? l.platform}
            >
              <SocialIcon platform={l.platform} size={18} />
            </a>
          ))}
        </div>
      );
    }
    if (socialStyle === 'outlined') {
      return (
        <div className={`flex flex-wrap gap-2 ${justify}`}>
          {profile.socialLinks.map((l, i) => (
            <a
              key={i}
              href={mode === 'live' ? l.url : undefined}
              target="_blank"
              rel="noreferrer noopener"
              className={`grid h-9 w-9 place-items-center rounded-lg border ${t.tapClass}`}
              style={{
                borderColor: layout === 'split' || layout === 'hero' || dark ? 'rgba(255,255,255,0.4)' : '#d4d4d8',
                color: layout === 'split' || layout === 'hero' || dark ? '#ffffff' : ink,
              }}
              aria-label={SOCIAL_LABEL[l.platform] ?? l.platform}
            >
              <SocialIcon platform={l.platform} size={17} />
            </a>
          ))}
        </div>
      );
    }
    return (
      <div className={`flex flex-wrap gap-2 ${justify}`}>
        {profile.socialLinks.map((l, i) => (
          <a
            key={i}
            href={mode === 'live' ? l.url : undefined}
            target="_blank"
            rel="noreferrer noopener"
            className={`sf-link-pill rounded-full px-3.5 py-2 text-xs font-semibold shadow-xs ${t.tapClass}`}
            style={{ backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#ffffff', color: ink, border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : '#eaeaf0'}` }}
          >
            {SOCIAL_LABEL[l.platform] ?? l.platform}
          </a>
        ))}
      </div>
    );
  }

  const avatarEl = showAvatar && (profile.avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={profile.avatarUrl} alt={profile.displayName} className={`${avatarRadius} shrink-0 object-cover ring-[3px] ring-white shadow-[0_8px_28px_-6px_rgba(15,15,25,0.35)]`} style={{ width: avatarSize, height: avatarSize }} />
    : <div className={`grid shrink-0 ${avatarRadius} font-bold text-white ring-[3px] ring-white shadow-[0_8px_28px_-6px_rgba(15,15,25,0.35)]`} style={{ width: avatarSize, height: avatarSize, background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})`, fontSize: avatarSize * 0.4, placeItems: 'center' }}>{(profile.displayName || profile.username).charAt(0).toUpperCase()}</div>);

  const headerNode = layout === 'hero' ? (
    <div>
      <div
        className="relative overflow-hidden"
        style={{
          height: hcfg.bannerHeight || 260,
          background: profile.avatarUrl
            ? `url(${profile.avatarUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${bannerColor}, ${bannerColor2})`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/75" />
        <div className={`relative z-10 flex h-full flex-col justify-end ${t.contentPx} pb-8 pt-16 text-center`}>
          <h1 className={`text-2xl font-bold leading-tight text-white ${nameClass}`}>{profile.displayName || `@${profile.username}`}</h1>
          {hcfg.showBio && profile.bio && (
            <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-white/80">{profile.bio}</p>
          )}
          <div className="mt-4">{renderSocials(true)}</div>
        </div>
      </div>
    </div>
  ) : layout === 'split' ? (
    <div className={`${t.contentPx} pt-6`}>
      <div className="flex overflow-hidden rounded-3xl shadow-lift" style={{ minHeight: 168 }}>
        <div className="w-[42%] shrink-0">
          {profile.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.avatarUrl} alt="" className="h-full min-h-[168px] w-full object-cover" />
            : <div className="h-full min-h-[168px] w-full" style={{ background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})` }} />}
        </div>
        <div className="flex flex-1 flex-col justify-center p-4 text-left" style={{ backgroundColor: hcfg.splitColor || t.accent }}>
          <h1 className={`text-lg font-bold leading-tight text-white ${nameClass}`}>{profile.displayName}</h1>
          {hcfg.showBio && profile.bio && (
            <p className="mt-2 text-sm leading-relaxed text-white/85">{profile.bio}</p>
          )}
          <div className="mt-3">{renderSocials()}</div>
        </div>
      </div>
    </div>
  ) : layout === 'banner-row' ? (
    <div>
      <div
        className="relative overflow-hidden"
        style={{
          height: hcfg.bannerHeight || 180,
          background: profile.avatarUrl
            ? `url(${profile.avatarUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${bannerColor}, ${bannerColor2})`,
        }}
      />
      <div className={`${t.contentPx} pt-5 ${hcfg.align === 'center' ? 'text-center' : ''}`}>
        {hcfg.align === 'center' ? (
          <>
            <h1 className={`text-[26px] font-bold leading-tight tracking-tight ${nameClass}`} style={{ color: hcfg.nameColor || ink }}>{profile.displayName}</h1>
            {hcfg.showBio && profile.bio && (
              <p className="mx-auto mt-2.5 max-w-[320px] text-[15px] leading-relaxed" style={{ color: sub }}>{profile.bio}</p>
            )}
            <div className="mt-5">{renderSocials(true)}</div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <h1 className={`text-2xl font-bold leading-tight ${nameClass}`} style={{ color: hcfg.nameColor || ink }}>{profile.displayName}</h1>
              {renderSocials()}
            </div>
            {hcfg.showBio && profile.bio && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: sub }}>{profile.bio}</p>
            )}
          </>
        )}
      </div>
    </div>
  ) : inlineHeader ? (
    <div className={`${t.contentPx} pt-6`}>
      <div className="flex items-start gap-3.5">
        {avatarEl}
        <div className="min-w-0 flex-1 text-left">
          <h1 className={`text-lg font-bold leading-tight tracking-tight ${nameClass}`} style={{ color: hcfg.nameColor || ink }}>{profile.displayName || `@${profile.username}`}</h1>
          {hcfg.showHandle && (
            <p className="mt-0.5 text-sm font-medium" style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#64748b' }}>@{profile.username}</p>
          )}
          {hcfg.showCategory && profile.category && (
            <p className="mt-1 text-sm font-semibold" style={{ color: t.accent }}>{profile.category}</p>
          )}
          <div className="mt-2.5">{renderSocials()}</div>
        </div>
      </div>
      {hcfg.showBio && profile.bio && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: sub }}>{profile.bio}</p>
      )}
    </div>
  ) : (
    <div>
      {hcfg.banner !== 'none' && layout !== 'hero' && (
        <div
          className="pointer-events-none relative overflow-hidden"
          style={{
            height: hcfg.bannerHeight,
            background: hcfg.banner === 'gradient' ? `linear-gradient(135deg, ${bannerColor} 0%, ${bannerColor2} 55%, ${bannerColor2}cc 100%)` : bannerColor,
            // Dissolve the banner into the page background instead of a hard
            // bottom edge — gives a soft, modern gradient-wash header.
            WebkitMaskImage: 'linear-gradient(to bottom, #000 42%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, #000 42%, transparent 100%)',
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 55%)' }} />
        </div>
      )}
      <div className={`flex flex-col ${headerAlign} ${t.contentPx}`} style={{ marginTop: hcfg.banner !== 'none' && showAvatar ? -(avatarSize / 2.4) : 24 }}>
        {avatarEl}
        <h1 className={`mt-4 text-[1.35rem] font-bold leading-tight tracking-tight ${nameClass}`} style={{ color: hcfg.nameColor || ink }}>{profile.displayName || `@${profile.username}`}</h1>
        {hcfg.showHandle && (
          <p className="mt-0.5 text-sm font-medium" style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#64748b' }}>@{profile.username}</p>
        )}
        {hcfg.showCategory && profile.category && (
          <p className="mt-1 text-sm font-semibold" style={{ color: t.accent }}>{profile.category}</p>
        )}
        {hcfg.showBio && profile.bio && (
          <p className="mt-2.5 max-w-[280px] text-sm leading-relaxed" style={{ color: sub }}>{profile.bio}</p>
        )}
        <div className="mt-4">{renderSocials(hcfg.align === 'center')}</div>
      </div>
    </div>
  );

  const defaultFooter = mode === 'live' ? (
    <footer className="pt-6 text-center">
      <Link
        href="/"
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold shadow-xs transition hover:shadow-soft ${t.tapClass}`}
        style={{
          borderColor: dark ? 'rgba(255,255,255,0.14)' : '#eaeaf0',
          backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#ffffff',
          color: sub,
        }}
      >
        ⚡ Powered by Stan
      </Link>
    </footer>
  ) : null;

  const headerEl = header ? selectable(header, headerNode, 0) : headerNode;

  // Sections with nothing to show (empty product/course/booking collections, a
  // featured block with no item, links with no socials…) are hidden in BOTH the
  // live page and the editor preview, so creators only ever see the sections
  // they've actually filled — never an "Empty …" placeholder.
  const offerNodes = ordered.map((b, idx) => {
    const node = renderBlock(b);
    if (node === null) return null;
    if (mode === 'live' && b.visible === false) return null;
    return selectable(b, node, idx + 1);
  });

  const footerEl =
    props.emptyOffersSlot || props.footerSlot || defaultFooter ? (
      <div className={`${t.contentPx} pt-2 text-center`}>
        {props.emptyOffersSlot}
        {props.footerSlot ?? defaultFooter}
      </div>
    ) : null;

  const shell = (children: ReactNode) => (
    <div
      style={{ background: pageBg, fontFamily: fontStack(t.fontPair), minHeight: mode === 'live' ? '100vh' : undefined }}
      className="pt-[env(safe-area-inset-top)]"
    >
      {children}
    </div>
  );

  // Preview (builder phone frame): single, stacked mobile column — WYSIWYG.
  if (mode !== 'live') {
    return shell(
      <div className="mx-auto max-w-md pb-[max(4rem,env(safe-area-inset-bottom))]">
        {headerEl}
        <div className={`mt-8 ${t.sectionGap} ${t.contentPx}`}>{offerNodes}</div>
        {footerEl}
      </div>,
    );
  }

  // Icon + label social pills for the desktop profile (annotation: add icons).
  const profileSocials =
    hcfg.showSocials && profile.socialLinks.length > 0 ? (
      <div className="flex flex-wrap justify-center gap-2">
        {profile.socialLinks.map((l, i) => (
          <a
            key={i}
            href={mode === 'live' ? l.url : undefined}
            target="_blank"
            rel="noreferrer noopener"
            className={`sf-link-pill inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-xs ${t.tapClass}`}
            style={{ backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#ffffff', color: ink, border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : '#eaeaf0'}` }}
            aria-label={SOCIAL_LABEL[l.platform] ?? l.platform}
          >
            <SocialIcon platform={l.platform} size={15} />
            {SOCIAL_LABEL[l.platform] ?? l.platform}
          </a>
        ))}
      </div>
    ) : null;

  // Render each visible offer block once, skipping the redundant social-links
  // block (it duplicates the profile's social icons). On desktop the email
  // signup moves into the left profile column (under the socials), so it's left
  // out of the offer grid there; on mobile it stays in the natural flow.
  const offerItems: { key: string; type: string; el: ReactNode }[] = [];
  ordered.forEach((b, idx) => {
    if (b.type === 'links') return;
    const node = renderBlock(b);
    if (node === null || b.visible === false) return;
    offerItems.push({ key: b.id, type: b.type, el: selectable(b, node, idx + 1) });
  });
  const emailItem = offerItems.find((it) => it.type === 'emailCapture') ?? null;
  const cardItems = offerItems.filter((it) => it.type !== 'emailCapture');
  const leftCol = cardItems.filter((_, i) => i % 2 === 0);
  const rightCol = cardItems.filter((_, i) => i % 2 === 1);

  // A clean, banner-free profile for the desktop left column: avatar, name,
  // category, bio, social icons, and the email signup form beneath them.
  const desktopProfile = (
    <div className="flex flex-col items-center px-2 text-center">
      {showAvatar &&
        (profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className={`${avatarRadius} object-cover ring-4 ring-white shadow-[0_12px_38px_-10px_rgba(15,15,25,0.45)]`}
            style={{ width: 132, height: 132 }}
          />
        ) : (
          <div
            className={`grid ${avatarRadius} font-bold text-white ring-4 ring-white shadow-[0_12px_38px_-10px_rgba(15,15,25,0.45)]`}
            style={{ width: 132, height: 132, fontSize: 53, placeItems: 'center', background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})` }}
          >
            {(profile.displayName || profile.username).charAt(0).toUpperCase()}
          </div>
        ))}
      <h1 className="mt-6 text-[1.75rem] font-bold leading-tight tracking-tight" style={{ color: hcfg.nameColor || ink }}>
        {profile.displayName || `@${profile.username}`}
      </h1>
      {hcfg.showHandle && (
        <p className="mt-1 text-sm font-medium" style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#64748b' }}>@{profile.username}</p>
      )}
      {hcfg.showCategory && profile.category && (
        <p className="mt-2 text-[15px] font-semibold" style={{ color: t.accent }}>{profile.category}</p>
      )}
      {hcfg.showBio && profile.bio && (
        <p className="mt-3.5 max-w-[300px] text-[15px] leading-relaxed" style={{ color: sub }}>{profile.bio}</p>
      )}
      {profileSocials && <div className="mt-6 w-full">{profileSocials}</div>}
      {emailItem && <div className="mt-7 w-full text-left">{emailItem.el}</div>}
    </div>
  );

  const offersArea = (
    <>
      {/* Mobile: one stacked column (cards + email, in order) */}
      <div className={`mt-8 ${t.contentPx} ${t.sectionGap} lg:hidden`}>
        {offerItems.map((it) => (
          <div key={it.key}>{it.el}</div>
        ))}
      </div>
      {/* Desktop: cards only, two-column row-major masonry with even gaps */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-6">
          {leftCol.map((it) => (
            <div key={it.key}>{it.el}</div>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          {rightCol.map((it) => (
            <div key={it.key}>{it.el}</div>
          ))}
        </div>
      </div>
    </>
  );

  // Live page: stacked on mobile (identical to the preview), and a two-column
  // layout on desktop — profile + socials + signup on the left, cards on the
  // right. The footer sits full-width, centered, beneath both columns.
  return shell(
    <div className="pb-[max(4rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md lg:grid lg:max-w-5xl lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8">
        <div className="lg:self-start lg:py-16">
          <div className="lg:hidden">{headerEl}</div>
          <div className="hidden lg:block">{desktopProfile}</div>
        </div>
        <div className="min-w-0 lg:py-14">{offersArea}</div>
      </div>
      {footerEl && <div className="mx-auto w-full max-w-md lg:max-w-5xl lg:px-8">{footerEl}</div>}
    </div>,
  );
}
