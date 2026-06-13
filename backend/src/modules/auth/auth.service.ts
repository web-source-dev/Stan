import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { UserModel, type UserDoc } from '../../models/User';
import { RefreshSessionModel } from '../../models/RefreshSession';
import { AuthTokenModel } from '../../models/AuthToken';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { generateJti, generateOpaqueToken, hashToken } from '../../lib/tokens';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';

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

export async function signup(email: string, password: string, ctx: RequestContext) {
  const existing = await UserModel.findOne({ email });
  if (existing) throw AppError.conflict('An account with that email already exists');

  const user = await UserModel.create({ email, passwordHash: await hashPassword(password) });
  await createAndSendVerification(user);
  recordAudit({ action: 'auth.signup', actorId: user.id, actorType: 'user', ...ctx });

  const tokens = await issueSession(user, ctx);
  return { user: publicUser(user), tokens };
}

export async function login(email: string, password: string, ctx: RequestContext) {
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

  user.lastLoginAt = new Date();
  await user.save();
  recordAudit({ action: 'auth.login', actorId: user.id, actorType: 'user', ...ctx });

  const tokens = await issueSession(user, ctx);
  return { user: publicUser(user), tokens };
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

  if (session.revokedAt || session.replacedByJti) {
    // Token reuse detected — invalidate every session for this user.
    await UserModel.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
    recordAudit({
      action: 'auth.refresh_reuse_detected',
      actorId: payload.sub,
      actorType: 'user',
      ...ctx,
    });
    throw AppError.unauthorized('Refresh token already used');
  }

  const user = await UserModel.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== 'active') throw AppError.unauthorized('Account is not active');
  if (user.tokenVersion !== payload.tokenVersion) throw AppError.unauthorized('Session invalidated');

  // Rotate: mark the current session replaced and issue a fresh one.
  const newTokens = await issueSession(user, ctx);
  const newPayload = verifyRefreshToken(newTokens.refreshToken);
  session.replacedByJti = newPayload.jti;
  await session.save();

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
