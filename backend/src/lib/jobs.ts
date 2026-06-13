import { JobModel, type JobType } from '../models/Job';

interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
}

/** Enqueue a durable background job. */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<string> {
  const job = await JobModel.create({
    type,
    payload,
    runAt: options.runAt ?? new Date(),
    maxAttempts: options.maxAttempts ?? 5,
  });
  return job.id;
}

/** Convenience: enqueue a transactional email send. */
export function enqueueEmail(
  to: string,
  template: string,
  data: Record<string, unknown>,
): Promise<string> {
  return enqueueJob('send_email', { to, template, data });
}
