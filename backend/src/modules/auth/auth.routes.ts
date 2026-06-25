import { Router } from 'express';
import { z } from 'zod';
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
  changePasswordSchema,
} from './auth.validators';

export const authRouter = Router();

// Throttle only the credential-bearing endpoints against brute force /
// credential stuffing. Routine session endpoints (/refresh, /logout, /me) run
// on every page load and must NOT use the strict limiter — they still fall
// under the global per-IP limiter applied app-wide.
authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), asyncHandler(ctrl.signup));
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(ctrl.login));
authRouter.post(
  '/login/verify-2fa',
  authLimiter,
  validate({
    body: z.object({
      challengeId: z.string().min(1).max(64),
      code: z.string().min(4).max(10),
      method: z.enum(['email', 'authenticator']),
    }),
  }),
  asyncHandler(ctrl.verifyTwoFactor),
);
authRouter.post(
  '/login/resend-2fa',
  authLimiter,
  validate({ body: z.object({ challengeId: z.string().min(1).max(64) }) }),
  asyncHandler(ctrl.resendTwoFactor),
);
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
authRouter.post('/change-password', authLimiter, requireAuth, validate({ body: changePasswordSchema }), asyncHandler(ctrl.changePassword));
