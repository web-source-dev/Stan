export interface AuthUser {
  id: string;
  email: string;
  role: 'creator' | 'admin';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  status: 'active' | 'suspended' | 'deactivated';
}

export interface Product {
  id: string;
  type: 'digital' | 'lead_magnet';
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: string;
  coverImageUrl: string;
  ctaLabel: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'unlisted';
  assetCount: number;
  salesCount: number;
  grossCents: number;
  assets?: { _id: string; publicId: string; filename: string; bytes: number; resourceType: string }[];
  thankYouMessage?: string;
}

export interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingStatus: 'not_started' | 'pending' | 'complete' | 'restricted';
  requirementsDue: string[];
}

export function formatPrice(cents: number, currency = 'usd'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'website',
  'whatsapp',
  'other',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface CreatorProfile {
  id: string;
  username: string;
  displayName: string;
  category: string;
  bio: string;
  avatarUrl: string;
  socialLinks: { platform: string; url: string }[];
  primaryCta: 'shop' | 'book' | 'subscribe' | 'lead' | 'none';
  published: boolean;
}

export interface StorefrontTheme {
  fontPair?: string;
  buttonStyle: 'solid' | 'outline' | 'soft';
  cardStyle: 'flat' | 'shadow' | 'border';
  background: string;
  accent: string;
}

export interface StorefrontSeo {
  title: string;
  description: string;
  ogImageUrl: string;
}

export interface StorefrontConfig {
  theme: StorefrontTheme;
  seo: StorefrontSeo;
  blocks: { id: string; type: string; config?: Record<string, unknown>; visible?: boolean }[];
}
