import type { Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE = 'cs_refresh';

// Scope the refresh cookie to the auth routes so it is not sent on every request.
const COOKIE_PATH = '/api/auth';

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
  });
}
