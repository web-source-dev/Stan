import rateLimit from 'express-rate-limit';

/** Generous default limiter applied to the whole API. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests, slow down' } },
});

/** Strict limiter for auth + other abuse-prone endpoints (brute force, stuffing). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } },
});

/** Limiter for public, unauthenticated write endpoints like lead capture. */
export const publicWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many submissions' } },
});
