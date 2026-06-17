import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import { AppError } from '../../utils/AppError';
import { verifyPortalToken } from '../../lib/jwt';
import { requestLoginCode, verifyLoginCode, getPortalDashboard } from './portal.service';

/**
 * Passwordless customer portal. A buyer requests a code for a creator's store,
 * verifies it for a 30-day session token, and reads back every purchase
 * (products, courses, bookings) tied to their email. Buyers are not User
 * accounts — the session is scoped to (email, creatorId).
 */
export const portalRouter = Router();

/** Require a valid portal session token; populates req.portal. */
function requirePortalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(AppError.unauthorized());
  try {
    const payload = verifyPortalToken(token);
    req.portal = { email: payload.sub, creatorId: payload.creatorId };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired session'));
  }
}

const emailSchema = z.string().email().max(200);

portalRouter.post(
  '/request-code',
  publicWriteLimiter,
  validate({ body: z.object({ username: z.string().min(1).max(80), email: emailSchema }) }),
  asyncHandler(async (req, res) => {
    const { username, email } = req.body as { username: string; email: string };
    const result = await requestLoginCode(username, email);
    res.json(result);
  }),
);

portalRouter.post(
  '/verify',
  publicWriteLimiter,
  validate({
    body: z.object({
      username: z.string().min(1).max(80),
      email: emailSchema,
      code: z.string().min(4).max(10),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { username, email, code } = req.body as { username: string; email: string; code: string };
    const result = await verifyLoginCode(username, email, code);
    res.json(result);
  }),
);

portalRouter.get(
  '/me',
  requirePortalAuth,
  asyncHandler(async (req, res) => {
    const { creatorId, email } = req.portal!;
    const data = await getPortalDashboard(creatorId, email);
    res.json(data);
  }),
);
