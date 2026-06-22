import { connectDb, disconnectDb } from './config/db';
import { logger } from './config/logger';
import { startJobRunner, stopJobRunner } from './lib/jobRunner';
import { registerBroadcastJobs } from './modules/broadcasts/broadcasts.service';
import { registerBookingJobs } from './modules/bookings/bookings.service';

/**
 * Optional standalone worker process. In the foundation phase the job runner
 * also runs in-process with the API (see index.ts); this entry exists so the
 * queue can be scaled out to a dedicated process without code changes.
 */
async function main() {
  await connectDb();
  registerBroadcastJobs();
  registerBookingJobs();
  startJobRunner();
  logger.info('Worker process started');

  const shutdown = async () => {
    stopJobRunner();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
