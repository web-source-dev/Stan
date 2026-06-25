import crypto from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { attributeSignup } from '../referrals/referrals.service';
import { UserModel, type UserDoc } from '../../models/User';
import { RefreshSessionModel } from '../../models/RefreshSession';
import { AuthTokenModel } from '../../models/AuthToken';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { generateJti, generateOpaqueToken, hashToken } from '../../lib/tokens';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import {
  activeTwoFactorMethods,
  twoFactorRequired,
  verifyTotpCode,
  type TwoFactorMethod,
} from '../../lib/totp';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const TWO_FACTOR_TTL_MS = 10 * 60 * 1000; // 10m
// A refresh token presented again within this window of being rotated is treated
// as a benign concurrent refresh / client retry (rejected softly), not as token
// theft. Reuse *after* this window still trips reuse-detection and kills the
// whole session family.
const REFRESH_REUSE_GRACE_MS = 30 * 1000; // 30s

function publicUser(user: UserDoc) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    status: user.status,
  };
}

function accessFor(user: UserDoc): string {
  return signAccessToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
}

/** Create a rotating refresh session and return both tokens. */
async function issueSession(user: UserDoc, ctx: RequestContext): Promise<SessionTokens> {
  const jti = generateJti();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshSessionModel.create({
    userId: user._id,
    jti,
    expiresAt,
    userAgent: ctx.userAgent ?? '',
    ip: ctx.ip ?? '',
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti, tokenVersion: user.tokenVersion });
  return { accessToken: accessFor(user), refreshToken };
}

async function createAndSendVerification(user: UserDoc): Promise<void> {
  const raw = generateOpaqueToken();
  await AuthTokenModel.create({
    userId: user._id,
    type: 'email_verify',
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  });
  const verifyUrl = `${env.APP_URL}/verify-email?token=${raw}`;
  await enqueueEmail(user.email, 'email_verification', { verifyUrl });
}

export async function signup(email: string, password: string, ctx: RequestContext, ref?: string) {
  const existing = await UserModel.findOne({ email });
  if (existing) throw AppError.conflict('An account with that email already exists');

  const user = await UserModel.create({ email, passwordHash: await hashPassword(password) });
  await createAndSendVerification(user);
  recordAudit({ action: 'auth.signup', actorId: user.id, actorType: 'user', ...ctx });

  // Attribute the signup to a referrer (best-effort — never blocks signup).
  // Only persist the referrer link when the code resolves to a real referral
  // record, so later subscription revenue can accrue commission to that creator.
  if (ref) {
    await attributeSignup(user, email, ref).catch(() => {});
  }

  const tokens = await issueSession(user, ctx);
  return { user: publicUser(user), tokens };
}

/** Issue a login challenge for enabled 2FA methods. */
async function createTwoFactorChallenge(user: UserDoc): Promise<{
  id: string;
  code?: string;
  methods: TwoFactorMethod[];
}> {
  const methods = activeTwoFactorMethods(user);
  if (methods.length === 0) {
    // Legacy accounts may only have twoFactorEnabled set.
    if (user.twoFactorAuthenticator) methods.push('authenticator');
    else methods.push('email');
  }

  await AuthTokenModel.deleteMany({ userId: user._id, type: 'two_factor' });

  let code: string | undefined;
  let tokenHash = hashToken(crypto.randomBytes(16).toString('hex'));
  if (methods.includes('email')) {
    code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    tokenHash = hashToken(code);
    await enqueueEmail(user.email, 'login_code', { code }).catch(() => {});
  }

  const token = await AuthTokenModel.create({
    userId: user._id,
    type: 'two_factor',
    tokenHash,
    expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MS),
    metadata: { methods },
  });
  return { id: token.id, code, methods };
}

export type LoginResult =
  | { user: ReturnType<typeof publicUser>; tokens: SessionTokens }
  | { twoFactorRequired: true; challengeId: string; methods: TwoFactorMethod[]; devCode?: string };

export async function login(email: string, password: string, ctx: RequestContext): Promise<LoginResult> {
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  // Constant-ish failure path: same error whether email or password is wrong.
  if (!user) {
    recordAudit({ action: 'auth.login_failed', actorType: 'anonymous', metadata: { email }, ...ctx });
    throw AppError.unauthorized('Invalid email or password');
  }
  if (user.status !== 'active') throw AppError.forbidden('Account is not active');

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    recordAudit({ action: 'auth.login_failed', actorId: user.id, actorType: 'user', ...ctx });
    throw AppError.unauthorized('Invalid email or password');
  }

  // Two-factor: password is correct, but require verification before a session.
  if (twoFactorRequired(user)) {
    const challenge = await createTwoFactorChallenge(user);
    recordAudit({ action: 'auth.2fa_challenge', actorId: user.id, actorType: 'user', metadata: { methods: challenge.methods }, ...ctx });
    return {
      twoFactorRequired: true,
      challengeId: challenge.id,
      methods: challenge.methods,
      ...(env.isProd || !challenge.code ? {} : { devCode: challenge.code }),
    };
  }

  user.lastLoginAt = new Date();
  await user.save();
  recordAudit({ action: 'auth.login', actorId: user.id, actorType: 'user', ...ctx });

  const tokens = await issueSession(user, ctx);
  return { user: publicUser(user), tokens };
}

/** Complete a 2FA login with email code or authenticator TOTP. */
export async function verifyTwoFactor(
  challengeId: string,
  code: string,
  method: TwoFactorMethod,
  ctx: RequestContext,
) {
  const invalid = 'That code is invalid or has expired. Please log in again.';
  const token = await AuthTokenModel.findOne({ _id: challengeId, type: 'two_factor', usedAt: { $exists: false } }).catch(
    () => null,
  );
  if (!token || token.expiresAt.getTime() < Date.now()) throw AppError.badRequest(invalid);

  const methods = (token.metadata?.methods as TwoFactorMethod[] | undefined) ?? ['email'];
  if (!methods.includes(method)) throw AppError.badRequest('That verification method is not available.');

  const user = await UserModel.findById(token.userId).select('+totpSecret');
  if (!user || user.status !== 'active') throw AppError.unauthorized('Account is not active');

  const trimmed = code.trim().replace(/\s/g, '');
  if (method === 'email') {
    if (token.tokenHash !== hashToken(trimmed)) throw AppError.badRequest('Incorrect code. Please try again.');
  } else {
    if (!user.totpSecret || !verifyTotpCode(trimmed, user.totpSecret)) {
      throw AppError.badRequest('Incorrect authenticator code. Please try again.');
    }
  }

  token.usedAt = new Date();
  await token.save();

  user.lastLoginAt = new Date();
  await user.save();
  recordAudit({ action: 'auth.login', actorId: user.id, actorType: 'user', metadata: { twoFactorMethod: method }, ...ctx });

  const tokens = await issueSession(user, ctx);
  return { user: publicUser(user), tokens };
}

/** Resend the email login code for an active 2FA challenge. */
export async function resendTwoFactorEmail(challengeId: string): Promise<void> {
  const token = await AuthTokenModel.findOne({ _id: challengeId, type: 'two_factor', usedAt: { $exists: false } });
  if (!token || token.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Challenge expired. Please log in again.');
  }
  const methods = (token.metadata?.methods as TwoFactorMethod[] | undefined) ?? ['email'];
  if (!methods.includes('email')) throw AppError.badRequest('Email verification is not enabled for this account.');

  const user = await UserModel.findById(token.userId);
  if (!user) throw AppError.badRequest('Challenge expired. Please log in again.');

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  token.tokenHash = hashToken(code);
  await token.save();
  await enqueueEmail(user.email, 'login_code', { code }).catch(() => {});
}

/**
 * Rotate a refresh token. Detects reuse of an already-rotated token and, when
 * found, revokes the whole session family by bumping the user's tokenVersion.
 */
export async function refresh(rawToken: string | undefined, ctx: RequestContext) {
  if (!rawToken) throw AppError.unauthorized('Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw AppError.unauthorized('Invalid refresh token');
  }

  const session = await RefreshSessionModel.findOne({ jti: payload.jti });
  if (!session) throw AppError.unauthorized('Session not found');

  // Explicitly revoked (logout / password reset / family invalidation). Reject
  // this request, but don't escalate to a family-wide kill — revocation is
  // already scoped, and escalating here would punish benign logout races.
  if (session.revokedAt) throw AppError.unauthorized('Session revoked');

  if (session.replacedByJti) {
    // The token was already rotated. Within the grace window this is a benign
    // concurrent refresh or client retry — reject this one request softly so the
    // client falls back to the token it already received. Outside the window it
    // looks like reuse of a long-dead token (likely theft): kill the family.
    const replacedAgoMs = Date.now() - (session.replacedAt?.getTime() ?? 0);
    if (replacedAgoMs > REFRESH_REUSE_GRACE_MS) {
      await UserModel.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      recordAudit({ action: 'auth.refresh_reuse_detected', actorId: payload.sub, actorType: 'user', ...ctx });
      throw AppError.unauthorized('Refresh token already used');
    }
    throw AppError.unauthorized('Refresh token already rotated');
  }

  const user = await UserModel.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== 'active') throw AppError.unauthorized('Account is not active');
  if (user.tokenVersion !== payload.tokenVersion) throw AppError.unauthorized('Session invalidated');

  // Rotate. Issue the new session first, then *atomically* claim the rotation of
  // the presented token: only the first concurrent caller flips replacedByJti
  // from unset. If we lose that race the new session we just created is an
  // orphan, so delete it and reject softly (no family kill) — this is what makes
  // concurrent refreshes safe instead of triggering a global logout.
  const newTokens = await issueSession(user, ctx);
  const newPayload = verifyRefreshToken(newTokens.refreshToken);
  const claimed = await RefreshSessionModel.findOneAndUpdate(
    { jti: payload.jti, revokedAt: { $exists: false }, replacedByJti: { $exists: false } },
    { $set: { replacedByJti: newPayload.jti, replacedAt: new Date() } },
  );
  if (!claimed) {
    await RefreshSessionModel.deleteOne({ jti: newPayload.jti });
    throw AppError.unauthorized('Refresh token already rotated');
  }

  return { user: publicUser(user), tokens: newTokens };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  try {
    const payload = verifyRefreshToken(rawToken);
    await RefreshSessionModel.updateOne(
      { jti: payload.jti, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  } catch {
    // Invalid token on logout is a no-op.
  }
}

export async function requestPasswordReset(email: string, ctx: RequestContext): Promise<void> {
  const user = await UserModel.findOne({ email });
  // Always behave the same to avoid leaking which emails are registered.
  if (!user) return;

  const raw = generateOpaqueToken();
  await AuthTokenModel.create({
    userId: user._id,
    type: 'password_reset',
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const resetUrl = `${env.APP_URL}/reset-password?token=${raw}`;
  await enqueueEmail(user.email, 'password_reset', { resetUrl });
  recordAudit({ action: 'auth.password_reset_requested', actorId: user.id, actorType: 'user', ...ctx });
}

export async function resetPassword(rawToken: string, newPassword: string, ctx: RequestContext): Promise<void> {
  const record = await AuthTokenModel.findOne({
    type: 'password_reset',
    tokenHash: hashToken(rawToken),
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Reset link is invalid or has expired');
  }

  const user = await UserModel.findById(record.userId).select('+tokenVersion');
  if (!user) throw AppError.badRequest('Reset link is invalid or has expired');

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1; // invalidate all existing sessions
  await user.save();

  record.usedAt = new Date();
  await record.save();

  await enqueueEmail(user.email, 'password_changed', {});
  recordAudit({ action: 'auth.password_reset', actorId: user.id, actorType: 'user', ...ctx });
}

export async function verifyEmail(rawToken: string, ctx: RequestContext) {
  const record = await AuthTokenModel.findOne({
    type: 'email_verify',
    tokenHash: hashToken(rawToken),
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Verification link is invalid or has expired');
  }

  const user = await UserModel.findById(record.userId);
  if (!user) throw AppError.badRequest('Verification link is invalid or has expired');

  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
  }
  record.usedAt = new Date();
  await record.save();
  recordAudit({ action: 'auth.email_verified', actorId: user.id, actorType: 'user', ...ctx });

  return { user: publicUser(user) };
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user || user.emailVerified) return;
  await createAndSendVerification(user);
}

export async function getMe(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw AppError.unauthorized('Account no longer exists');
  return { user: publicUser(user) };
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw AppError.unauthorized('Account no longer exists');
  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) throw AppError.badRequest('Current password is incorrect');
  user.passwordHash = await hashPassword(next);
  await user.save();
  recordAudit({ action: 'auth.password_changed', actorId: user.id, actorType: 'user' });
}
