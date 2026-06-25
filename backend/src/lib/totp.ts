import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import type { UserDoc } from '../models/User';

const APP_NAME = 'Stan';
/** ±2 time steps (30s each) for clock skew between server and authenticator app. */
const TOTP_WINDOW = 2;

export type TwoFactorMethod = 'email' | 'authenticator';

/** Whether any 2FA method is active for this user. */
export function twoFactorRequired(user: UserDoc): boolean {
  if (user.twoFactorEmail || user.twoFactorAuthenticator) return true;
  return Boolean(user.twoFactorEnabled);
}

/** Whether email OTP is enabled (includes legacy twoFactorEnabled-only accounts). */
export function emailTwoFactorEnabled(user: UserDoc): boolean {
  if (user.twoFactorEmail) return true;
  if (user.twoFactorAuthenticator) return false;
  return Boolean(user.twoFactorEnabled);
}

/** Whether authenticator app is enabled (confirmed during setup). */
export function authenticatorTwoFactorEnabled(user: UserDoc): boolean {
  return Boolean(user.twoFactorAuthenticator);
}

/** Active verification methods for login. */
export function activeTwoFactorMethods(user: UserDoc): TwoFactorMethod[] {
  const methods: TwoFactorMethod[] = [];
  if (emailTwoFactorEnabled(user)) methods.push('email');
  if (authenticatorTwoFactorEnabled(user)) methods.push('authenticator');
  return methods;
}

export function generateTotpSecret(): string {
  return normalizeTotpSecret(speakeasy.generateSecret({ length: 20 }).base32);
}

export function normalizeTotpSecret(secret: string): string {
  return secret.replace(/\s/g, '').toUpperCase();
}

export function normalizeTotpToken(token: string): string {
  const digits = token.replace(/\D/g, '');
  if (digits.length !== 6) return digits;
  return digits;
}

export function totpKeyUri(email: string, secret: string): string {
  return speakeasy.otpauthURL({
    secret: normalizeTotpSecret(secret),
    label: email,
    issuer: APP_NAME,
    encoding: 'base32',
    algorithm: 'sha1',
  });
}

export async function totpQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 2, width: 200 });
}

export function verifyTotpCode(token: string, secret: string): boolean {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedToken = normalizeTotpToken(token);
  if (!normalizedSecret || normalizedToken.length !== 6) return false;
  return speakeasy.totp.verify({
    secret: normalizedSecret,
    encoding: 'base32',
    token: normalizedToken,
    window: TOTP_WINDOW,
  });
}

/** Keep legacy twoFactorEnabled in sync with per-method flags. */
export function syncTwoFactorEnabled(user: UserDoc): void {
  user.twoFactorEnabled = emailTwoFactorEnabled(user) || authenticatorTwoFactorEnabled(user);
}
