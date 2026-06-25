import { AppError } from '../../utils/AppError';
import { UserModel, type UserDoc } from '../../models/User';
import { verifyPassword } from '../../lib/password';
import {
  activeTwoFactorMethods,
  authenticatorTwoFactorEnabled,
  emailTwoFactorEnabled,
  generateTotpSecret,
  normalizeTotpSecret,
  syncTwoFactorEnabled,
  totpKeyUri,
  totpQrDataUrl,
  verifyTotpCode,
} from '../../lib/totp';
import { recordAudit } from '../../lib/audit';

export interface TwoFactorStatus {
  enabled: boolean;
  email: boolean;
  authenticator: boolean;
  methods: ('email' | 'authenticator')[];
}

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const user = await UserModel.findById(userId).select('+totpSecret');
  if (!user) throw AppError.notFound('User not found');
  const methods = activeTwoFactorMethods(user);
  return {
    enabled: methods.length > 0,
    email: emailTwoFactorEnabled(user),
    authenticator: authenticatorTwoFactorEnabled(user),
    methods,
  };
}

async function requirePassword(user: UserDoc, password: string): Promise<void> {
  const withHash = await UserModel.findById(user._id).select('+passwordHash');
  if (!withHash || !(await verifyPassword(password, withHash.passwordHash))) {
    throw AppError.badRequest('Incorrect password');
  }
}

/** Toggle email 2FA (requires password). */
export async function setEmailTwoFactor(userId: string, enabled: boolean, password: string): Promise<TwoFactorStatus> {
  const user = await UserModel.findById(userId).select('+totpSecret +passwordHash');
  if (!user) throw AppError.notFound('User not found');
  await requirePassword(user, password);

  if (!enabled && !authenticatorTwoFactorEnabled(user)) {
    throw AppError.badRequest('Enable at least one verification method, or keep email on.');
  }

  user.twoFactorEmail = enabled;
  if (!enabled) {
    user.twoFactorEnabled = false;
  }
  syncTwoFactorEnabled(user);
  await user.save();
  recordAudit({ action: enabled ? 'account.2fa_email_enabled' : 'account.2fa_email_disabled', actorId: userId, actorType: 'user' });
  return getTwoFactorStatus(userId);
}

/** Start authenticator setup — returns QR + secret (not enabled until confirmed). */
export async function startAuthenticatorSetup(userId: string, password: string) {
  const user = await UserModel.findById(userId).select('+passwordHash +totpSecret');
  if (!user) throw AppError.notFound('User not found');
  await requirePassword(user, password);

  const secret = generateTotpSecret();
  user.totpSecret = secret;
  user.twoFactorAuthenticator = false;
  await user.save();

  const otpauthUrl = totpKeyUri(user.email, secret);
  const qrDataUrl = await totpQrDataUrl(otpauthUrl);
  return { otpauthUrl, secret, qrDataUrl };
}

/** Discard a pending authenticator setup (secret stored but not yet confirmed). */
export async function cancelAuthenticatorSetup(userId: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+totpSecret');
  if (!user || user.twoFactorAuthenticator) return;
  user.totpSecret = '';
  await user.save();
}

/** Confirm authenticator setup with a code from the app. */
export async function confirmAuthenticatorSetup(
  userId: string,
  code: string,
  setupSecret?: string,
): Promise<TwoFactorStatus> {
  const user = await UserModel.findById(userId).select('+totpSecret');
  if (!user) throw AppError.notFound('User not found');
  if (user.twoFactorAuthenticator) {
    throw AppError.badRequest('Authenticator is already enabled.');
  }

  const secret = normalizeTotpSecret(setupSecret?.trim() || user.totpSecret?.trim() || '');
  if (!secret) {
    throw AppError.badRequest('Start authenticator setup first.');
  }
  if (!verifyTotpCode(code, secret)) {
    throw AppError.badRequest('Incorrect code. Check your authenticator app and try again.');
  }

  user.totpSecret = secret;
  user.twoFactorAuthenticator = true;
  syncTwoFactorEnabled(user);
  await user.save();
  recordAudit({ action: 'account.2fa_authenticator_enabled', actorId: userId, actorType: 'user' });
  return getTwoFactorStatus(userId);
}

/** Disable authenticator app (requires password + current TOTP code). */
export async function disableAuthenticator(userId: string, password: string, code: string): Promise<TwoFactorStatus> {
  const user = await UserModel.findById(userId).select('+passwordHash +totpSecret');
  if (!user) throw AppError.notFound('User not found');
  await requirePassword(user, password);

  if (!authenticatorTwoFactorEnabled(user)) {
    throw AppError.badRequest('Authenticator is not enabled.');
  }
  if (!verifyTotpCode(code, user.totpSecret)) {
    throw AppError.badRequest('Incorrect authenticator code.');
  }

  if (!emailTwoFactorEnabled(user)) {
    throw AppError.badRequest('Enable email verification first, or you will be locked out.');
  }

  user.twoFactorAuthenticator = false;
  user.totpSecret = '';
  syncTwoFactorEnabled(user);
  await user.save();
  recordAudit({ action: 'account.2fa_authenticator_disabled', actorId: userId, actorType: 'user' });
  return getTwoFactorStatus(userId);
}
