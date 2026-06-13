import { templateBlock } from './builder';
import type { StoreTemplate } from './types';

const horizontal = {
  layout: 'horizontal' as const,
  showImage: true,
  showPrice: true,
  showDescription: true,
  showRating: true,
  showArrow: true,
  cardRadius: '2xl' as const,
  shadow: 'soft' as const,
};

/** Themes tuned to match `/public/stan/themes/{id}.png` reference screenshots. */
export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: 'studio',
    name: 'Studio',
    theme: {
      fontPair: 'default',
      buttonStyle: 'solid',
      cardStyle: 'shadow',
      background: '#ffffff',
      accent: '#0066ff',
      accent2: '#3b82f6',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'elevated',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        align: 'center', avatarShape: 'circle', banner: 'none', avatarSize: 112,
        showCategory: false, socialStyle: 'icons', showBio: true,
      }),
      templateBlock('product', {
        ...horizontal, startIndex: 0, maxItems: 1,
        title: '', buttonLabel: 'Book a call', ctaStyle: 'solid', shadow: 'lift',
      }),
      templateBlock('product', {
        layout: 'horizontal-compact', startIndex: 1, maxItems: 1,
        showImage: true, showPrice: true, showRating: true, showDescription: false,
        cardRadius: '2xl', shadow: 'soft',
      }),
    ],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    theme: {
      fontPair: 'default',
      buttonStyle: 'solid',
      cardStyle: 'border',
      background: '#0d1127',
      accent: '#00ffd1',
      accent2: '#00e5cc',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'glass',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        align: 'center', avatarShape: 'square', banner: 'none', avatarSize: 120,
        showCategory: false, socialStyle: 'icons',
      }),
      templateBlock('product', {
        ...horizontal, title: '', buttonLabel: 'Get it now', ctaStyle: 'neon',
        shadow: 'none', cardRadius: 'xl',
      }),
    ],
  },
  {
    id: 'blush',
    name: 'Blush',
    theme: {
      fontPair: 'poppins',
      buttonStyle: 'solid',
      cardStyle: 'shadow',
      background: '#fff5f8',
      accent: '#ff4499',
      accent2: '#ff6eb4',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'elevated',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        profileLayout: 'split', splitColor: '#ff4499', showCategory: false,
        banner: 'none', socialStyle: 'icons',
      }),
      templateBlock('product', {
        layout: 'horizontal-compact', startIndex: 0, maxItems: 1,
        cardBg: '#ff4499', showImage: true, showPrice: true, showRating: true,
        showDescription: false, cardRadius: '2xl', shadow: 'lift',
      }),
      templateBlock('product', {
        ...horizontal, startIndex: 1, maxItems: 1,
        cardBg: '#ff4499', buttonLabel: 'Join Now', ctaStyle: 'inverse', shadow: 'lift',
      }),
    ],
  },
  {
    id: 'violet',
    name: 'Violet',
    theme: {
      fontPair: 'poppins',
      buttonStyle: 'solid',
      cardStyle: 'flat',
      background: '#7a1dff',
      accent: '#7a1dff',
      accent2: '#9333ea',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'flat',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        align: 'center', avatarShape: 'circle', banner: 'none', avatarSize: 112,
        showCategory: false, nameColor: '#ffffff', socialStyle: 'icons',
      }),
      templateBlock('product', {
        ...horizontal, title: '', cardBg: '#8b3dff', buttonLabel: 'Schedule Call',
        ctaStyle: 'inverse', shadow: 'none',
      }),
    ],
  },
  {
    id: 'wellness',
    name: 'Wellness',
    theme: {
      fontPair: 'serif',
      buttonStyle: 'solid',
      cardStyle: 'shadow',
      background: '#f5f3ef',
      accent: '#6366f1',
      accent2: '#818cf8',
      backgroundStyle: 'flat',
      spacing: 'airy',
      cardChrome: 'elevated',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        profileLayout: 'hero', bannerHeight: 280, showAvatar: false, showBio: false,
        showCategory: false, socialStyle: 'icons',
      }),
      templateBlock('product', {
        ...horizontal, title: '', cardBg: '#fffdf9', buttonLabel: 'Start now',
        ctaStyle: 'solid', shadow: 'lift',
      }),
    ],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    theme: {
      fontPair: 'serif',
      buttonStyle: 'solid',
      cardStyle: 'shadow',
      background: '#fce7f3',
      accent: '#ec4899',
      accent2: '#f472b6',
      backgroundStyle: 'flat',
      spacing: 'airy',
      cardChrome: 'elevated',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        align: 'center', avatarShape: 'circle', banner: 'none', avatarSize: 108,
        showCategory: false, socialStyle: 'icons', nameItalic: false,
      }),
      templateBlock('product', {
        ...horizontal, title: '', cardBg: '#fbcfe8', showRating: false,
        buttonLabel: 'Join the Vault', ctaStyle: 'solid', shadow: 'lift',
      }),
    ],
  },
  {
    id: 'noir',
    name: 'Noir',
    theme: {
      fontPair: 'default',
      buttonStyle: 'solid',
      cardStyle: 'flat',
      background: '#000000',
      accent: '#ffffff',
      accent2: '#a3a3a3',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'flat',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        profileLayout: 'hero', bannerHeight: 240, showAvatar: false, showBio: false,
        showCategory: false, socialStyle: 'icons',
      }),
      templateBlock('product', {
        ...horizontal, startIndex: 0, maxItems: 1,
        cardBg: '#1c1c1e', buttonLabel: 'Book now', ctaStyle: 'inverse', shadow: 'none',
      }),
      templateBlock('product', {
        ...horizontal, startIndex: 1, maxItems: 1,
        cardBg: '#1c1c1e', buttonLabel: 'Get it now', ctaStyle: 'inverse', shadow: 'none',
        showRating: false,
      }),
    ],
  },
  {
    id: 'editorial',
    name: 'Editorial',
    theme: {
      fontPair: 'serif',
      buttonStyle: 'solid',
      cardStyle: 'flat',
      background: '#faf9f6',
      accent: '#4a4744',
      accent2: '#b08968',
      backgroundStyle: 'flat',
      spacing: 'airy',
      cardChrome: 'flat',
      motion: 'none',
    },
    build: () => [
      templateBlock('header', {
        profileLayout: 'banner-row', bannerHeight: 200, showAvatar: false,
        align: 'center', showCategory: false, socialStyle: 'outlined', nameItalic: true,
      }),
      templateBlock('product', {
        ...horizontal, title: '', cardBg: '#ebe3de', showRating: false,
        buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'soft',
      }),
    ],
  },
  {
    id: 'bloom',
    name: 'Bloom',
    theme: {
      fontPair: 'serif',
      buttonStyle: 'outline',
      cardStyle: 'shadow',
      background: '#f5e6f7',
      accent: '#1f1f1f',
      accent2: '#9333ea',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'elevated',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        profileLayout: 'banner-row', bannerHeight: 200, showAvatar: false,
        showCategory: false, socialStyle: 'icons', align: 'left',
      }),
      templateBlock('product', {
        layout: 'horizontal-compact', startIndex: 0, maxItems: 1,
        showImage: true, showPrice: true, showRating: true, showDescription: false,
        cardRadius: 'xl', shadow: 'soft', cardBg: '#ffffff',
      }),
      templateBlock('featured', {
        itemSlug: 'glow-guide', buttonLabel: 'Subscribe', ctaStyle: 'outline',
        showArrow: true, cardRadius: '2xl', shadow: 'soft',
      }),
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    theme: {
      fontPair: 'default',
      buttonStyle: 'solid',
      cardStyle: 'shadow',
      background: '#ffffff',
      accent: '#2d6a5f',
      accent2: '#14b8a6',
      backgroundStyle: 'flat',
      spacing: 'comfortable',
      cardChrome: 'elevated',
      motion: 'subtle',
    },
    build: () => [
      templateBlock('header', {
        profileLayout: 'inline', showHandle: true, align: 'left',
        avatarShape: 'circle', banner: 'none', avatarSize: 72,
        showCategory: false, socialStyle: 'outlined',
      }),
      templateBlock('booking', {
        layout: 'horizontal-compact', showImage: true, showPrice: true,
        showRating: true, showDescription: false, cardRadius: 'xl', shadow: 'soft',
      }),
      templateBlock('product', {
        ...horizontal, title: '', buttonLabel: 'Get it now', ctaStyle: 'solid', shadow: 'lift',
      }),
    ],
  },
];

export function getTemplate(id: string): StoreTemplate | undefined {
  return STORE_TEMPLATES.find((t) => t.id === id);
}
