import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import { AppError } from '../../utils/AppError';
import { auditContext } from '../../lib/audit';
import { verifyPortalToken, verifyGlobalPortalToken } from '../../lib/jwt';
import {
  requestLoginCode,
  verifyLoginCode,
  getPortalDashboard,
  getPortalOrders,
  getPortalPrefs,
  setPortalPrefs,
  requestGlobalLoginCode,
  verifyGlobalLoginCode,
  getGlobalDashboard,
  getGlobalOrders,
} from './portal.service';

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

/** Require a valid global portal token; populates req.globalPortalEmail. */
function requireGlobalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(AppError.unauthorized());
  try {
    const payload = verifyGlobalPortalToken(token);
    req.globalPortalEmail = payload.sub;
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired session'));
  }
}

const emailSchema = z.string().email().max(200).transform((e) => e.toLowerCase().trim());

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
    const result = await verifyLoginCode(username, email, code, auditContext(req));
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

portalRouter.get(
  '/me/orders',
  requirePortalAuth,
  asyncHandler(async (req, res) => {
    const { creatorId, email } = req.portal!;
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const orders = await getPortalOrders(creatorId, email, skip, limit);
    res.json({ orders });
  }),
);

portalRouter.get(
  '/me/prefs',
  requirePortalAuth,
  asyncHandler(async (req, res) => {
    const { creatorId, email } = req.portal!;
    res.json(await getPortalPrefs(creatorId, email));
  }),
);

portalRouter.post(
  '/me/prefs',
  requirePortalAuth,
  validate({ body: z.object({ subscribed: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const { creatorId, email } = req.portal!;
    const { subscribed } = req.body as { subscribed: boolean };
    res.json(await setPortalPrefs(creatorId, email, { subscribed }));
  }),
);

/* ---------------------------------------------------------------- */
/* Global portal — one buyer, every store they've purchased from     */
/* ---------------------------------------------------------------- */

portalRouter.post(
  '/global/request-code',
  publicWriteLimiter,
  validate({ body: z.object({ email: emailSchema }) }),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    res.json(await requestGlobalLoginCode(email));
  }),
);

portalRouter.post(
  '/global/verify',
  publicWriteLimiter,
  validate({ body: z.object({ email: emailSchema, code: z.string().min(4).max(10) }) }),
  asyncHandler(async (req, res) => {
    const { email, code } = req.body as { email: string; code: string };
    res.json(await verifyGlobalLoginCode(email, code, auditContext(req)));
  }),
);

portalRouter.get(
  '/global/me',
  requireGlobalAuth,
  asyncHandler(async (req, res) => {
    res.json(await getGlobalDashboard(req.globalPortalEmail!));
  }),
);

portalRouter.get(
  '/global/me/orders',
  requireGlobalAuth,
  asyncHandler(async (req, res) => {
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const orders = await getGlobalOrders(req.globalPortalEmail!, skip, limit);
    res.json({ orders });
  }),
);
