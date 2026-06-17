import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { startJobRunner, stopJobRunner } from './lib/jobRunner';
import { registerBroadcastJobs } from './modules/broadcasts/broadcasts.service';
import { startBookingMaintenance, stopBookingMaintenance } from './modules/bookings/bookings.service';

async function main() {
  await connectDb();

  // Register module job handlers before the runner starts polling.
  registerBroadcastJobs();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    if (!env.cloudinaryConfigured) logger.warn('Cloudinary not configured — uploads disabled');
    if (!env.emailConfigured) logger.warn('Resend not configured — emails will be logged only');
    if (!env.instagramConfigured) logger.warn('Meta/Instagram not configured — AutoDM runs in simulation mode (replies logged, not sent)');
  });

  // In-process job runner for the foundation phase. Can be split into a
  // separate worker process later via `npm run worker`.
  startJobRunner();
  startBookingMaintenance();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopJobRunner();
    stopBookingMaintenance();
    server.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
