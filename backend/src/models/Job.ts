import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const JOB_TYPES = [
  'send_email',
  'cloudinary_cleanup',
  'fulfilment',
  'booking_reminder',
  'webinar_reminder',
  'broadcast_send',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

/**
 * Durable async work queue backed by MongoDB. The job runner claims due jobs
 * (status=pending, runAt<=now) atomically, executes the registered handler, and
 * retries with backoff on failure up to `maxAttempts`.
 */
const jobSchema = new Schema(
  {
    type: { type: String, enum: JOB_TYPES, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    // Optional idempotency key. When set, a unique index guarantees the same
    // logical job is never enqueued twice (e.g. per-recipient broadcast emails),
    // which makes resumable/retried producers safe to re-run.
    dedupeKey: { type: String },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    runAt: { type: Date, default: Date.now },
    lockedAt: { type: Date },
    lastError: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

// Hot path for the runner: find the next due, pending job.
jobSchema.index({ status: 1, runAt: 1 });
// Idempotency: at most one job per dedupeKey. Sparse so jobs without a key are
// unaffected.
jobSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export type Job = InferSchemaType<typeof jobSchema>;
export type JobDoc = HydratedDocument<Job>;

export const JobModel = model('Job', jobSchema);
