import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { UserModel, type UserRole } from '../models/User';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Require a valid access token. Loads the user to enforce live state
 * (suspension, forced logout via tokenVersion) rather than trusting the token
 * payload alone.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearer(req);
    if (!token) throw AppError.unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw AppError.unauthorized('Invalid or expired token');
    }

    const user = await UserModel.findById(payload.sub).select('tokenVersion role status emailVerified');
    if (!user) throw AppError.unauthorized('Account no longer exists');
    if (user.status !== 'active') throw AppError.forbidden('Account is not active');
    if (user.tokenVersion !== payload.tokenVersion) {
      throw AppError.unauthorized('Session has been invalidated');
    }

    req.user = { id: user.id, role: user.role, emailVerified: user.emailVerified };
    next();
  } catch (err) {
    next(err);
  }
}

/** Require the authenticated user to hold one of the given roles. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

/** Require a verified email (gates publishing-related actions per the PRD). */
export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(AppError.unauthorized());
  // When email delivery isn't configured (dev/demo), users have no way to
  // verify, so don't gate features behind verification.
  if (!env.emailConfigured && !env.isProd) return next();
  if (!req.user.emailVerified) {
    return next(new AppError(403, 'email_unverified', 'Verify your email to continue'));
  }
  next();
}
