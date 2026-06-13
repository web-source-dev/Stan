import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

// Any localhost / 127.0.0.1 / [::1] origin on any port, over http or https.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests (no Origin header), any localhost
    // origin (any port), and explicitly allowlisted origins.
    if (!origin || LOCALHOST_ORIGIN.test(origin) || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new AppError(403, 'cors_rejected', `Origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
});

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Reject write requests that do not declare a JSON content type, per OWASP REST
 * guidance on validating content types. Webhook routes (raw body) are mounted
 * before this runs and are exempt.
 */
export function requireJsonContentType(req: Request, _res: Response, next: NextFunction) {
  if (METHODS_WITH_BODY.has(req.method)) {
    const contentType = req.headers['content-type'] ?? '';
    const hasBody = req.headers['content-length'] && req.headers['content-length'] !== '0';
    if (hasBody && !contentType.includes('application/json')) {
      return next(new AppError(415, 'unsupported_media_type', 'Content-Type must be application/json'));
    }
  }
  next();
}
