import { JobModel, type JobDoc } from '../models/Job';
import { logger } from '../config/logger';
import { deliverEmail, renderEmail, type EmailTemplate } from './email';

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Registry of job handlers. New job types register here. Handlers must be
 * idempotent where the side effect could be retried.
 */
const handlers: Record<string, JobHandler> = {
  send_email: async (payload) => {
    const { to, template, data, fromName, replyTo } = payload as {
      to: string;
      template: EmailTemplate;
      data: Record<string, unknown>;
      fromName?: string;
      replyTo?: string;
    };
    const rendered = renderEmail(template, data as never);
    await deliverEmail(to, rendered, { fromName, replyTo });
  },
};

const POLL_INTERVAL_MS = 2000;
const BACKOFF_BASE_MS = 5000;
// A job left in `processing` longer than this is assumed orphaned (the worker
// crashed mid-handler) and is reclaimed for retry. Handlers must be idempotent.
const STUCK_JOB_MS = 2 * 60 * 1000;
const RECLAIM_INTERVAL_MS = 30 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;
let lastReclaim = 0;

/** Atomically claim the next due, pending job. */
async function claimNextJob(): Promise<JobDoc | null> {
  return JobModel.findOneAndUpdate(
    { status: 'pending', runAt: { $lte: new Date() } },
    { $set: { status: 'processing', lockedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { runAt: 1 }, new: true },
  );
}

/**
 * Recover jobs orphaned by a crashed worker: a job stuck in `processing` past
 * the timeout is requeued (if attempts remain) or failed. Without this, a crash
 * mid-handler would strand the job forever, since the runner only claims
 * `pending` rows.
 */
async function reclaimStuckJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_JOB_MS);
  await JobModel.updateMany(
    { status: 'processing', lockedAt: { $lt: cutoff }, $expr: { $lt: ['$attempts', '$maxAttempts'] } },
    { $set: { status: 'pending', runAt: new Date() }, $unset: { lockedAt: '' } },
  );
  await JobModel.updateMany(
    { status: 'processing', lockedAt: { $lt: cutoff }, $expr: { $gte: ['$attempts', '$maxAttempts'] } },
    { $set: { status: 'failed', lastError: 'Worker crashed or timed out (stuck in processing)' } },
  );
}

async function processOne(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
    await handler(job.payload as Record<string, unknown>);
    job.status = 'completed';
    job.completedAt = new Date();
    job.lastError = undefined;
    await job.save();
    logger.debug({ jobId: job.id, type: job.type }, 'Job completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.lastError = message;
      logger.error({ jobId: job.id, type: job.type, err }, 'Job failed permanently');
    } else {
      // Exponential backoff before the next attempt.
      job.status = 'pending';
      job.runAt = new Date(Date.now() + BACKOFF_BASE_MS * 2 ** (job.attempts - 1));
      job.lastError = message;
      logger.warn({ jobId: job.id, type: job.type, attempts: job.attempts }, 'Job retry scheduled');
    }
    await job.save();
  }
  return true;
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Periodically recover jobs orphaned by a crashed worker.
    if (Date.now() - lastReclaim > RECLAIM_INTERVAL_MS) {
      lastReclaim = Date.now();
      await reclaimStuckJobs();
    }
    // Drain a small batch each tick to avoid starving under load.
    for (let i = 0; i < 10; i += 1) {
      const processed = await processOne();
      if (!processed) break;
    }
  } catch (err) {
    logger.error({ err }, 'Job runner tick error');
  } finally {
    running = false;
  }
}

export function startJobRunner(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  logger.info('Job runner started');
}

export function stopJobRunner(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers[type] = handler;
}
