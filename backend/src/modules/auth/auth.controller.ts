import type { Request, Response } from 'express';
import * as authService from './auth.service';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from '../../lib/cookies';
import { auditContext } from '../../lib/audit';

function ctx(req: Request) {
  return auditContext(req);
}

export async function signup(req: Request, res: Response) {
  const { email, password, ref } = req.body;
  const { user, tokens } = await authService.signup(email, password, ctx(req), ref);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json({ user, accessToken: tokens.accessToken });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const { user, tokens } = await authService.login(email, password, ctx(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ user, accessToken: tokens.accessToken });
}

export async function refresh(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  const { user, tokens } = await authService.refresh(raw, ctx(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ user, accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.requestPasswordReset(req.body.email, ctx(req));
  // Always 202 regardless of whether the email exists.
  res.status(202).json({ message: 'If that email exists, a reset link has been sent' });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password, ctx(req));
  res.json({ message: 'Password updated. Please log in again.' });
}

export async function verifyEmail(req: Request, res: Response) {
  const { user } = await authService.verifyEmail(req.body.token, ctx(req));
  res.json({ user });
}

export async function resendVerification(req: Request, res: Response) {
  await authService.resendVerification(req.user!.id);
  res.status(202).json({ message: 'Verification email sent if your account is unverified' });
}

export async function me(req: Request, res: Response) {
  const { user } = await authService.getMe(req.user!.id);
  res.json({ user });
}

export async function changePassword(req: Request, res: Response) {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  res.json({ ok: true });
}
