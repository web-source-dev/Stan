import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express's
 * error middleware. Express 5 forwards rejected promises from handlers
 * automatically, but wrapping keeps behaviour explicit and version-independent.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
