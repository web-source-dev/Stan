import { templateBlock } from './builder';
import type { StoreTemplate } from './types';

/** Standard horizontal offer-card config — soft, roomy cards. */
const card = {
  layout: 'horizontal' as const,
  showImage: true,
  showPrice: true,
  showDescription: true,
  showRating: true,
  showArrow: true,
  cardRadius: '2xl' as const,
  shadow: 'soft' as const,
};

const compact = {
  layout: 'horizontal-compact' as const,
  showImage: true,
  showPrice: true,
  showRating: true,
  showDescription: false,
  cardRadius: '2xl' as const,
  shadow: 'soft' as const,
};

/**
 * Revamped, curated theme set — cohesive modern palettes with generous radius,
 * airy spacing and refined typography. Ids are kept stable (demo + preview maps
 * key off them); only the display name + palette are refreshed.
 */
export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: 'studio',
    name: 'Aurora',
    theme: {
      fontPair: 'default', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#ffffff', accent: '#5b54e8', accent2: '#8b80fc',
      backgroundStyle: 'gradient', spacing: 'comfortable', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { align: 'center', avatarShape: 'circle', banner: 'none', avatarSize: 120, showCategory: false, socialStyle: 'icons', showBio: true }),
      templateBlock('product', { ...card, startIndex: 0, maxItems: 1, title: '', buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'lift' }),
      templateBlock('product', { ...compact, startIndex: 1, maxItems: 1 }),
    ],
  },
  {
    id: 'midnight',
    name: 'Onyx',
    theme: {
      fontPair: 'default', buttonStyle: 'soft', cardStyle: 'border',
      background: '#0e0e13', accent: '#cdc7ff', accent2: '#8b80fc',
      backgroundStyle: 'mesh', spacing: 'comfortable', cardChrome: 'glass', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { align: 'center', avatarShape: 'circle', banner: 'none', avatarSize: 120, showCategory: false, socialStyle: 'icons' }),
      templateBlock('product', { ...card, title: '', buttonLabel: 'Get it now', ctaStyle: 'inverse', shadow: 'none', cardRadius: 'xl' }),
    ],
  },
  {
    id: 'blush',
    name: 'Rosewood',
    theme: {
      fontPair: 'poppins', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#fdf1f3', accent: '#e0517a', accent2: '#f08aa8',
      backgroundStyle: 'flat', spacing: 'comfortable', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'split', splitColor: '#e0517a', showCategory: false, banner: 'none', socialStyle: 'icons' }),
      templateBlock('product', { ...compact, startIndex: 0, maxItems: 1, cardBg: '#e0517a' }),
      templateBlock('product', { ...card, startIndex: 1, maxItems: 1, cardBg: '#e0517a', buttonLabel: 'Join now', ctaStyle: 'inverse', shadow: 'lift' }),
    ],
  },
  {
    id: 'violet',
    name: 'Lilac',
    theme: {
      fontPair: 'poppins', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#f3effe', accent: '#7c5cff', accent2: '#a78bfa',
      backgroundStyle: 'flat', spacing: 'comfortable', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'hero', bannerHeight: 260, showAvatar: false, showBio: false, showCategory: false, socialStyle: 'icons' }),
      templateBlock('product', { ...card, title: '', cardBg: '#ffffff', buttonLabel: 'Join the Vault', ctaStyle: 'solid', shadow: 'lift' }),
      templateBlock('product', { ...compact, startIndex: 1, maxItems: 1, cardBg: '#ffffff' }),
    ],
  },
  {
    id: 'wellness',
    name: 'Linen',
    theme: {
      fontPair: 'poppins', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#f6f1e8', accent: '#bb6a4c', accent2: '#d89c84',
      backgroundStyle: 'flat', spacing: 'airy', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'hero', bannerHeight: 280, showAvatar: false, showBio: false, showCategory: false, socialStyle: 'outlined' }),
      templateBlock('product', { ...card, title: '', cardBg: '#fffdf9', buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'soft' }),
      templateBlock('product', { ...compact, startIndex: 1, maxItems: 1, cardBg: '#fffdf9' }),
    ],
  },
  {
    id: 'pastel',
    name: 'Pine',
    theme: {
      fontPair: 'default', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#eef3ef', accent: '#2f7d5b', accent2: '#4fb38a',
      backgroundStyle: 'flat', spacing: 'comfortable', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'inline', showHandle: true, align: 'left', avatarShape: 'circle', banner: 'none', avatarSize: 72, showCategory: false, socialStyle: 'outlined' }),
      templateBlock('booking', { ...compact }),
      templateBlock('product', { ...card, title: '', buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'lift', cardBg: '#ffffff' }),
    ],
  },
  {
    id: 'noir',
    name: 'Noir',
    theme: {
      fontPair: 'default', buttonStyle: 'solid', cardStyle: 'flat',
      background: '#0c0c0e', accent: '#f2efe6', accent2: '#a3a3a3',
      backgroundStyle: 'flat', spacing: 'comfortable', cardChrome: 'flat', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'hero', bannerHeight: 260, showAvatar: false, showBio: false, showCategory: false, socialStyle: 'icons' }),
      templateBlock('product', { ...card, startIndex: 0, maxItems: 1, cardBg: '#19191c', buttonLabel: 'Get it now', ctaStyle: 'inverse', shadow: 'none' }),
      templateBlock('product', { ...card, startIndex: 1, maxItems: 1, cardBg: '#19191c', buttonLabel: 'Get it now', ctaStyle: 'inverse', shadow: 'none', showRating: false }),
    ],
  },
  {
    id: 'editorial',
    name: 'Sand',
    theme: {
      fontPair: 'serif', buttonStyle: 'solid', cardStyle: 'flat',
      background: '#f8f5ef', accent: '#9a6b4b', accent2: '#c2956f',
      backgroundStyle: 'flat', spacing: 'airy', cardChrome: 'flat', motion: 'none',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'banner-row', bannerHeight: 200, showAvatar: false, align: 'center', showCategory: false, socialStyle: 'outlined', nameItalic: true }),
      templateBlock('product', { ...card, title: '', cardBg: '#efe9df', showRating: false, buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'soft' }),
    ],
  },
  {
    id: 'bloom',
    name: 'Coral',
    theme: {
      fontPair: 'poppins', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#fff4ee', accent: '#f2683f', accent2: '#ff8a5c',
      backgroundStyle: 'flat', spacing: 'comfortable', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'banner-row', bannerHeight: 200, showAvatar: false, align: 'center', showCategory: false, socialStyle: 'icons' }),
      templateBlock('product', { ...card, title: '', cardBg: '#ffffff', buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'lift' }),
      templateBlock('product', { ...compact, startIndex: 1, maxItems: 1, cardBg: '#ffffff' }),
    ],
  },
  {
    id: 'ocean',
    name: 'Marine',
    theme: {
      fontPair: 'default', buttonStyle: 'solid', cardStyle: 'shadow',
      background: '#eef6f6', accent: '#0e8a86', accent2: '#2dd4bf',
      backgroundStyle: 'flat', spacing: 'comfortable', cardChrome: 'elevated', motion: 'subtle',
    },
    build: () => [
      templateBlock('header', { profileLayout: 'inline', showHandle: true, align: 'left', avatarShape: 'circle', banner: 'none', avatarSize: 72, showCategory: false, socialStyle: 'outlined' }),
      templateBlock('booking', { ...compact, cardBg: '#ffffff' }),
      templateBlock('product', { ...card, title: '', buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'lift', cardBg: '#ffffff' }),
    ],
  },
];

export function getTemplate(id: string): StoreTemplate | undefined {
  return STORE_TEMPLATES.find((t) => t.id === id);
}
