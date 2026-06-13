import crypto from 'node:crypto';

/** Generate a high-entropy URL-safe token (for email verify / password reset links). */
export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Hash a token for at-rest storage so a DB leak does not expose live tokens. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Random identifier for refresh-token sessions (jti). */
export function generateJti(): string {
  return crypto.randomUUID();
}
