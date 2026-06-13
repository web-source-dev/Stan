import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Centralised, validated environment configuration.
 * The process refuses to start if required variables are missing or malformed,
 * which keeps misconfiguration from turning into runtime surprises.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('CreatorStore <onboarding@example.com>'),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV === 'development',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  cloudinaryConfigured: Boolean(
    raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET,
  ),
  emailConfigured: Boolean(raw.RESEND_API_KEY),
  stripeConfigured: Boolean(raw.STRIPE_SECRET_KEY),
  // Dev-only fallback: when Stripe isn't configured (and we're not in
  // production), checkout simulates a completed purchase so the full
  // purchase → fulfilment → access flow is demonstrable without API keys.
  // NEVER active in production — there, missing Stripe correctly blocks sales.
  demoCheckout: !raw.STRIPE_SECRET_KEY && raw.NODE_ENV !== 'production',
};

export type Env = typeof env;
