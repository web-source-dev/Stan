import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/User';

const ISSUER = 'creatorstore';
const AUDIENCE = 'creatorstore-api';
// A separate audience so customer-portal sessions can never be presented as
// creator access tokens (and vice versa) even though they share a secret.
const PORTAL_AUDIENCE = 'creatorstore-portal';
const PORTAL_TTL = '30d';

export interface AccessTokenPayload {
  sub: string; // userId
  role: UserRole;
  tokenVersion: number;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string;
  tokenVersion: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const opts: SignOptions = {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, opts);
}

/** Verify integrity, issuer, audience, and expiry per OWASP REST guidance. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as RefreshTokenPayload;
}

export interface PortalTokenPayload {
  /** Buyer email (lowercased). */
  sub: string;
  /** Creator whose store the buyer is signed in to. */
  creatorId: string;
}

/** Sign a passwordless customer-portal session token (scoped to one creator). */
export function signPortalToken(payload: PortalTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: PORTAL_AUDIENCE,
    expiresIn: PORTAL_TTL,
  });
}

export function verifyPortalToken(token: string): PortalTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: PORTAL_AUDIENCE,
  }) as PortalTokenPayload;
}
