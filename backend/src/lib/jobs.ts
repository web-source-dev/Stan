import { JobModel, type JobType } from '../models/Job';

interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
  /** Idempotency key — a second enqueue with the same key is a no-op. */
  dedupeKey?: string;
}

/**
 * Enqueue a durable background job. When a `dedupeKey` is supplied and a job
 * with that key already exists, this is a no-op (returns the existing job id)
 * so resumable/retried producers can safely re-enqueue without duplicating work.
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<string> {
  try {
    const job = await JobModel.create({
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 5,
      dedupeKey: options.dedupeKey,
    });
    return job.id;
  } catch (err) {
    // Duplicate dedupeKey — the job is already enqueued. Return the existing id.
    if (options.dedupeKey && typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      const existing = await JobModel.findOne({ dedupeKey: options.dedupeKey }).select('_id');
      if (existing) return existing.id;
    }
    throw err;
  }
}

/** Convenience: enqueue a transactional email send. */
export function enqueueEmail(
  to: string,
  template: string,
  data: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<string> {
  return enqueueJob('send_email', { to, template, data }, options);
}
