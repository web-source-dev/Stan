import { logger } from '../config/logger';
import { startJobRunner, stopJobRunner } from './jobRunner';
import { registerBroadcastJobs } from '../modules/broadcasts/broadcasts.service';
import {
  registerBookingJobs,
  startBookingMaintenance,
  stopBookingMaintenance,
} from '../modules/bookings/bookings.service';
import { registerWebinarJobs } from '../modules/webinars/webinars.service';
import {
  startSubscriptionMaintenance,
  stopSubscriptionMaintenance,
} from '../modules/subscription/subscription.service';
import {
  startInstagramTokenMaintenance,
  stopInstagramTokenMaintenance,
} from '../modules/integrations/instagramTokenMaintenance';

/** Register all MongoDB job-queue handlers (email, broadcasts, booking reminders). */
export function registerJobHandlers(): void {
  registerBroadcastJobs();
  registerBookingJobs();
  registerWebinarJobs();
}

/**
 * Start the durable job runner and periodic maintenance sweeps.
 * Safe to call once per process — internal timers are idempotent.
 */
export function startBackgroundWorkers(): void {
  registerJobHandlers();
  startJobRunner();
  startBookingMaintenance();
  startSubscriptionMaintenance();
  startInstagramTokenMaintenance();
  logger.info('Background workers started (job runner + maintenance)');
}

export function stopBackgroundWorkers(): void {
  stopJobRunner();
  stopBookingMaintenance();
  stopSubscriptionMaintenance();
  stopInstagramTokenMaintenance();
  logger.info('Background workers stopped');
}
