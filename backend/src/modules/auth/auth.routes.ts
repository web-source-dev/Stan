import { Router } from 'express';
import * as ctrl from './auth.controller';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validators';

export const authRouter = Router();

// Throttle only the credential-bearing endpoints against brute force /
// credential stuffing. Routine session endpoints (/refresh, /logout, /me) run
// on every page load and must NOT use the strict limiter — they still fall
// under the global per-IP limiter applied app-wide.
authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), asyncHandler(ctrl.signup));
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(ctrl.login));
authRouter.post('/refresh', asyncHandler(ctrl.refresh));
authRouter.post('/logout', asyncHandler(ctrl.logout));

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(ctrl.forgotPassword),
);
authRouter.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(ctrl.resetPassword),
);
authRouter.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), asyncHandler(ctrl.verifyEmail));
authRouter.post('/resend-verification', authLimiter, requireAuth, asyncHandler(ctrl.resendVerification));

authRouter.get('/me', requireAuth, asyncHandler(ctrl.me));
