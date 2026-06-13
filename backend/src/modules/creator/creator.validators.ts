import { z } from 'zod';

// 3–30 chars, lowercase letters/numbers/underscore, must start with a letter.
// A reserved list prevents claiming route-conflicting or impersonating names.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,29}$/, 'Use 3–30 chars: letters, numbers, underscore; start with a letter');

export const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'app', 'dashboard', 'login', 'logout', 'signup', 'settings',
  'about', 'help', 'support', 'terms', 'privacy', 'pricing', 'checkout', 'cart',
  'me', 'you', 'root', 'system', 'creatorstore', 'www', 'static', 'assets',
  'verify-email', 'reset-password', 'forgot-password', 'onboarding',
]);

const socialLink = z.object({
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'x', 'website', 'whatsapp', 'other']),
  url: z.string().url(),
});

export const checkUsernameSchema = z.object({
  username: usernameSchema,
});

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(80).optional(),
    category: z.string().trim().max(60).optional(),
    bio: z.string().max(500).optional(),
    avatarPublicId: z.string().max(300).optional(),
    avatarUrl: z.string().url().max(1000).optional().or(z.literal('')),
    socialLinks: z.array(socialLink).max(10).optional(),
    primaryCta: z.enum(['shop', 'book', 'subscribe', 'lead', 'none']).optional(),
  })
  .strict();

export const onboardingSchema = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().min(1).max(80),
    category: z.string().trim().max(60).optional().default(''),
    bio: z.string().max(500).optional().default(''),
    avatarPublicId: z.string().max(300).optional().default(''),
    avatarUrl: z.string().url().max(1000).optional().or(z.literal('')).default(''),
    socialLinks: z.array(socialLink).max(10).optional().default([]),
    primaryCta: z.enum(['shop', 'book', 'subscribe', 'lead', 'none']).optional().default('none'),
    firstProductType: z.enum(['digital', 'course', 'booking', 'lead_magnet', 'skip']).optional(),
  })
  .strict();

export const updateStorefrontSchema = z
  .object({
    theme: z
      .object({
        fontPair: z.string().optional(),
        buttonStyle: z.enum(['solid', 'outline', 'soft']).optional(),
        cardStyle: z.enum(['flat', 'shadow', 'border']).optional(),
        background: z.string().optional(),
        accent: z.string().optional(),
        accent2: z.string().optional().or(z.literal('')),
        backgroundStyle: z.enum(['solid', 'gradient', 'mesh']).optional(),
        spacing: z.enum(['compact', 'comfortable', 'airy']).optional(),
        cardChrome: z.enum(['elevated', 'flat', 'glass']).optional(),
        motion: z.enum(['none', 'subtle', 'expressive']).optional(),
        templateId: z.string().max(40).optional(),
      })
      .optional(),
    blocks: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum([
            'header', 'featured', 'product', 'course', 'booking', 'leadMagnet', 'emailCapture', 'links',
            'hero', 'testimonial', 'faq', 'gallery',
            'heading', 'text', 'button', 'image', 'divider',
          ]),
          config: z.record(z.string(), z.unknown()).optional(),
          visible: z.boolean().optional(),
        }),
      )
      .max(50)
      .optional(),
    seo: z
      .object({
        title: z.string().max(120).optional(),
        description: z.string().max(300).optional(),
        ogImageUrl: z.string().url().max(1000).optional().or(z.literal('')),
      })
      .optional(),
  })
  .strict();

export const usernameParam = z.object({ username: usernameSchema });
