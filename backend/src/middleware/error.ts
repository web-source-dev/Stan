import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound('Route not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors -> 400 with field details
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid request', details: err.flatten() },
    });
  }

  // Mongo duplicate key -> 409
  if (
    err instanceof mongoose.mongo.MongoServerError &&
    (err as { code?: number }).code === 11000
  ) {
    const fields = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {});
    return res.status(409).json({
      error: {
        code: 'conflict',
        message: `A record with that ${fields.join(', ') || 'value'} already exists`,
      },
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong' },
  });
}
