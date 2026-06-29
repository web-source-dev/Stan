import { connectDb, disconnectDb } from './config/db';
import { logger } from './config/logger';
import { startBackgroundWorkers, stopBackgroundWorkers } from './lib/workerBootstrap';

/**
 * Dedicated background worker process. Polls the MongoDB job queue for emails,
 * broadcast sends, booking reminders, and runs periodic maintenance sweeps.
 *
 * Production:  npm run build && npm run start:worker
 * Development: npm run dev:worker   (third terminal alongside API + frontend)
 *
 * When this process is running, set JOB_RUNNER_IN_PROCESS=false on the API so
 * only one process claims jobs from the queue.
 */
async function main() {
  await connectDb();
  startBackgroundWorkers();
  logger.info('Worker process ready');

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down worker`);
    stopBackgroundWorkers();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
