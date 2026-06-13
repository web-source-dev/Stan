import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { corsMiddleware, requireJsonContentType } from './middleware/security';
import { globalLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';
import { apiRouter } from './routes';
import { webhookRouter } from './routes/webhooks';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(cookieParser());

  // Webhooks need the raw body for signature verification, so they are mounted
  // BEFORE the JSON body parser and content-type guard.
  app.use('/webhooks', webhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(requireJsonContentType);
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
