import type { SFItem, SFProfile } from '@/storefront/renderer/StoreCanvas';

export interface TemplateDemo {
  profile?: Partial<SFProfile>;
  products: SFItem[];
  courses?: SFItem[];
  bookingTypes?: SFItem[];
}

const thumb = (seed: string) => `https://picsum.photos/seed/${seed}/160/160`;

/** Preview fixtures — titles/prices match each carousel reference screenshot. */
export const TEMPLATE_DEMOS: Record<string, TemplateDemo> = {
  midnight: {
    profile: {
      displayName: 'Ethan Walker',
      bio: 'Telling stories in color, texture, and emotion, one brushstroke at a time.',
    },
    products: [{
      id: 'd-midnight',
      title: 'Creative Expression',
      slug: 'creative-expression',
      shortDescription: 'Unlock your creative potential with guided lessons and projects.',
      priceCents: 7000,
      currency: 'usd',
      coverImageUrl: thumb('midnight'),
      ctaLabel: 'Get it now',
      type: 'digital',
    }],
  },
  blush: {
    profile: {
      displayName: 'Nora Hayes',
      bio: 'Helping you learn Spanish with fun and tailored lessons with practical tips.',
    },
    products: [
      {
        id: 'd-blush-1',
        title: 'Conversación Express',
        slug: 'conversacion-express',
        shortDescription: '',
        priceCents: 10000,
        currency: 'usd',
        coverImageUrl: thumb('blush1'),
        type: 'digital',
      },
      {
        id: 'd-blush-2',
        title: 'Spanish flow coaching',
        slug: 'spanish-flow',
        shortDescription: 'Personalized Spanish speaking sessions to boost your fluency.',
        priceCents: 10000,
        currency: 'usd',
        coverImageUrl: thumb('blush2'),
        ctaLabel: 'Join Now',
        type: 'digital',
      },
    ],
  },
  violet: {
    profile: {
      displayName: 'Joanna Kelly',
      bio: 'Botanical know-how meets floral design. Get the tools to arrange with confidence.',
    },
    products: [{
      id: 'd-violet',
      title: 'Bouquet Design Session',
      slug: 'bouquet-design',
      shortDescription: 'Personalized support for your floral designs or biz ideas.',
      priceCents: 8500,
      currency: 'usd',
      coverImageUrl: thumb('violet'),
      ctaLabel: 'Schedule Call',
      type: 'digital',
    }],
  },
  wellness: {
    profile: {
      displayName: 'Isabella Smith',
      bio: '',
    },
    products: [{
      id: 'd-wellness',
      title: 'Personalized wellness plans',
      slug: 'wellness-plans',
      shortDescription: 'Custom wellness plans based on your goals, and daily habits.',
      priceCents: 9000,
      currency: 'usd',
      coverImageUrl: thumb('wellness'),
      ctaLabel: 'Start now',
      type: 'digital',
    }],
  },
  pastel: {
    profile: {
      displayName: 'Coach Trish',
      bio: 'Instagram Growth Strategist & AI Prompt Coach',
    },
    products: [{
      id: 'd-pastel',
      title: 'Defining Business Strategy',
      slug: 'business-strategy',
      shortDescription: 'Unlock the Vault: Your All-in-One Membership for CHATGPT Prompts, Tools, and Content Strategy!',
      priceCents: 1700,
      currency: 'usd',
      coverImageUrl: thumb('pastel'),
      ctaLabel: 'Join the Vault',
      type: 'digital',
    }],
  },
  noir: {
    profile: {
      displayName: 'Stone Fredrickson',
      bio: '',
    },
    products: [
      {
        id: 'd-noir-1',
        title: '1:1 Social Media Growth 30 minute coaching session',
        slug: 'coaching-session',
        shortDescription: 'Gain my expert eyes on your content to optimize and grow.',
        priceCents: 15000,
        currency: 'usd',
        coverImageUrl: thumb('noir1'),
        ctaLabel: 'Book now',
        type: 'digital',
      },
      {
        id: 'd-noir-2',
        title: 'Proven 4-Step Guide to Grow & Monetize! (free)',
        slug: 'growth-guide',
        shortDescription: 'Building a profitable audience takes strategy. This guide shows you how.',
        priceCents: 0,
        currency: 'usd',
        coverImageUrl: thumb('noir2'),
        ctaLabel: 'Get it now',
        type: 'digital',
      },
    ],
  },
  editorial: {
    profile: {
      displayName: 'Tyla Brimblecombe',
      bio: 'Helping creators & entrepreneurs build bold brands that stand out and sell.',
    },
    products: [{
      id: 'd-editorial',
      title: 'The Brand Blueprint',
      slug: 'brand-blueprint',
      shortDescription: 'A clear guide to build your personal brand with purpose.',
      priceCents: 4900,
      currency: 'usd',
      coverImageUrl: thumb('editorial'),
      ctaLabel: 'Get it now',
      type: 'digital',
    }],
  },
  bloom: {
    profile: {
      displayName: 'Kelsie',
      bio: 'Glow expert enhancing natural beauty through advanced skincare & makeup artistry.',
    },
    products: [
      {
        id: 'd-bloom-1',
        title: 'Custom Skincare Tips',
        slug: 'skincare-tips',
        shortDescription: '',
        priceCents: 8000,
        currency: 'usd',
        coverImageUrl: thumb('bloom1'),
        type: 'digital',
      },
      {
        id: 'd-bloom-2',
        title: 'Natural glow guide',
        slug: 'glow-guide',
        shortDescription: 'Step-by-step routines for radiant, healthy skin.',
        priceCents: 8000,
        currency: 'usd',
        coverImageUrl: thumb('bloom2'),
        ctaLabel: 'Subscribe',
        type: 'digital',
      },
    ],
  },
  studio: {
    profile: {
      displayName: 'Yuna Parker',
      bio: 'Helping you win on social media',
    },
    products: [
      {
        id: 'd-studio-1',
        title: 'Grow Your Reach',
        slug: 'grow-reach',
        shortDescription: 'Get personalized tips to grow on social media.',
        priceCents: 4900,
        currency: 'usd',
        coverImageUrl: thumb('studio1'),
        ctaLabel: 'Book a call',
        type: 'digital',
      },
      {
        id: 'd-studio-2',
        title: 'Ask me Anything, get 60 second video response',
        slug: 'ask-me',
        shortDescription: '',
        priceCents: 6500,
        currency: 'usd',
        coverImageUrl: thumb('studio2'),
        type: 'digital',
      },
    ],
  },
  ocean: {
    profile: {
      displayName: 'Rohan Singh',
      bio: '',
    },
    bookingTypes: [{
      id: 'd-ocean-book',
      title: 'Book a Consultation',
      slug: 'consultation',
      shortDescription: '',
      priceCents: 10000,
      currency: 'usd',
      coverImageUrl: thumb('ocean-book'),
      type: 'booking',
    }],
    products: [{
      id: 'd-ocean',
      title: 'Saving & Investing Guide',
      slug: 'investing-guide',
      shortDescription: 'Learn the fundamentals of saving and investing for your future.',
      priceCents: 6000,
      currency: 'usd',
      coverImageUrl: thumb('ocean'),
      ctaLabel: 'Get it now',
      type: 'digital',
    }],
  },
};

export function demoForTemplate(templateId: string): TemplateDemo | undefined {
  return TEMPLATE_DEMOS[templateId];
}
