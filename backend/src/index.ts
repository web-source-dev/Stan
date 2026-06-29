import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { startBackgroundWorkers, stopBackgroundWorkers } from './lib/workerBootstrap';
import { clearPlaceholderStripeAccounts } from './modules/payments/connect.service';

async function main() {
  await connectDb();
  await clearPlaceholderStripeAccounts();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    if (!env.cloudinaryConfigured) logger.warn('Cloudinary not configured — uploads disabled');
    if (!env.emailConfigured) logger.warn('Resend not configured — emails will be logged only');
    if (env.instagramConfigured) logger.info('Instagram configured — live AutoDM delivery enabled');
    else logger.warn('Instagram not configured — AutoDM runs in simulation mode (replies logged, not sent)');
    if (env.stripeConfigured) logger.info('Stripe configured — real checkout enabled (creators must connect Stripe Connect)');
    else if (env.demoCheckout) logger.warn('Stripe not configured — checkout runs in demo mode');
    if (env.paypalConfigured) logger.info(`PayPal configured (${env.PAYPAL_ENV}) — live PayPal checkout enabled`);
    else if (env.paypalDemo) logger.warn('PayPal not configured — PayPal checkout runs in demo mode');
  });

  if (env.jobRunnerInProcess) {
    startBackgroundWorkers();
  } else {
    logger.info('JOB_RUNNER_IN_PROCESS=false — enqueue-only mode; run `npm run worker` to process jobs');
  }

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    if (env.jobRunnerInProcess) stopBackgroundWorkers();
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
