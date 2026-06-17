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
  productKind?: string;
  thumbnailStyle?: string;
  bottomTitle?: string;
  discountPriceCents?: number;
  deliveryMode?: string;
  redirectUrl?: string;
  confirmSubject?: string;
  confirmBody?: string;
  reviewsEnabled?: boolean;
  reviews?: { id: string; author: string; quote: string; rating: number; avatarUrl?: string }[];
  emailFlows?: { id: string; dayOffset: number; subject: string; body: string; enabled: boolean }[];
  orderBumpEnabled?: boolean;
  orderBumpTitle?: string;
  orderBumpDescription?: string;
  orderBumpPriceCents?: number;
  affiliateEnabled?: boolean;
  affiliateCommissionPercent?: number;
  paymentPlanEnabled?: boolean;
  paymentPlanInstallments?: number;
  discountCodes?: { id: string; code: string; type: 'percent' | 'fixed'; value: number }[];
  quantityLimit?: number;
  customFields?: { id: string; label: string; type: 'text' | 'textarea' | 'phone'; required: boolean }[];
  assets?: { _id: string; publicId: string; filename: string; bytes: number; resourceType: string }[];
  thankYouMessage?: string;
  coverPublicId?: string;
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
  phone?: string;
  avatarUrl: string;
  socialLinks: { platform: string; url: string }[];
  analytics?: { facebookPixelId?: string; googleAnalyticsId?: string; tiktokPixelId?: string; pinterestTag?: string };
  address?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string };
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
