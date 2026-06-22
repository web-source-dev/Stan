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

  // PayPal (OPTIONAL). Platform-level REST app credentials. Without them the
  // PayPal option runs in demo mode (instant simulated capture) in non-prod.
  // Each creator connects by saving their PayPal email (the payee) in Settings.
  PAYPAL_CLIENT_ID: z.string().optional().default(''),
  PAYPAL_SECRET: z.string().optional().default(''),
  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  // Webhook id from the PayPal app (Webhooks). Enables signature verification on
  // /webhooks/paypal — capture-fallback + refund sync. Optional in dev.
  PAYPAL_WEBHOOK_ID: z.string().optional().default(''),

  // Stanley AI assistant (Anthropic). Optional — without a key the assistant
  // falls back to a deterministic, data-aware responder.
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ASSISTANT_MODEL: z.string().default('claude-sonnet-4-6'),

  // Instagram AutoDM (OPTIONAL — without App ID/Secret the AutoDM engine runs in
  // simulation mode: rules still match and replies are logged, but no live
  // OAuth/webhook/Graph delivery happens).
  //
  // This uses the "Instagram API with Instagram Login" flow (the same one
  // stan.store uses): the creator authorizes with their Instagram credentials
  // directly — no Facebook Page required. Credentials come from the Instagram
  // app shown under "API setup with Instagram login" in the Meta App Dashboard.
  INSTAGRAM_APP_ID: z.string().optional().default(''),
  INSTAGRAM_APP_SECRET: z.string().optional().default(''),
  INSTAGRAM_GRAPH_VERSION: z.string().default('v21.0'),
  // Where Instagram redirects the browser back after consent. Instagram requires
  // an HTTPS URL (localhost is rejected), so in local dev this must be a public
  // tunnel, e.g. https://<host>.trycloudflare.com/api/integrations/instagram/callback
  INSTAGRAM_REDIRECT_URI: z
    .string()
    .optional()
    .default('http://localhost:4000/api/integrations/instagram/callback'),
  // Shared secret echoed back during the webhook subscription handshake.
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
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
  aiConfigured: Boolean(raw.ANTHROPIC_API_KEY),
  // Instagram is "configured" once we have Instagram app credentials. Without
  // them the AutoDM engine still runs (keyword match + simulated reply), so the
  // feature is demonstrable locally and goes live the moment keys are added.
  instagramConfigured: Boolean(raw.INSTAGRAM_APP_ID && raw.INSTAGRAM_APP_SECRET),
  // Dev-only fallback: when Stripe isn't configured (and we're not in
  // production), checkout simulates a completed purchase so the full
  // purchase → fulfilment → access flow is demonstrable without API keys.
  // NEVER active in production — there, missing Stripe correctly blocks sales.
  demoCheckout: !raw.STRIPE_SECRET_KEY && raw.NODE_ENV !== 'production',
  // PayPal is "configured" once platform REST credentials exist. Without them,
  // the PayPal option simulates a completed capture in non-production so the
  // full flow is demonstrable; production requires real credentials.
  paypalConfigured: Boolean(raw.PAYPAL_CLIENT_ID && raw.PAYPAL_SECRET),
  paypalDemo: !(raw.PAYPAL_CLIENT_ID && raw.PAYPAL_SECRET) && raw.NODE_ENV !== 'production',
};

export type Env = typeof env;
