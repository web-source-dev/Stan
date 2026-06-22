import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { BroadcastModel, type Segment, type BroadcastDoc } from '../../models/Broadcast';
import { LeadModel } from '../../models/Lead';
import { JobModel } from '../../models/Job';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { enqueueEmail, enqueueJob } from '../../lib/jobs';
import { registerJobHandler } from '../../lib/jobRunner';
import { recordAudit } from '../../lib/audit';

type Repeat = 'none' | 'weekly' | 'monthly';

/** The next occurrence for a recurring broadcast. */
function nextOccurrence(from: Date, repeat: Repeat): Date | null {
  if (repeat === 'weekly') return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (repeat === 'monthly') {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  return null;
}

/** Resolve a segment to its emailable recipients (excludes unsubscribed). */
async function resolveRecipients(creatorId: string, segment: Segment) {
  const base: Record<string, unknown> = { creatorId, unsubscribedAt: { $exists: false } };
  if (segment === 'customers') base.isCustomer = true;
  if (segment === 'subscribers') base.optInStatus = 'confirmed';
  return LeadModel.find(base).select('email firstName').lean();
}

export async function previewSegment(creatorId: string, segment: Segment) {
  const recipients = await resolveRecipients(creatorId, segment);
  return { segment, count: recipients.length };
}

function publicBroadcast(b: BroadcastDoc) {
  return {
    id: b.id,
    subject: b.subject,
    segment: b.segment,
    status: b.status,
    scheduledAt: b.get('scheduledAt') ?? null,
    repeat: b.get('repeat') ?? 'none',
    recipientCount: b.recipientCount,
    sentAt: b.sentAt,
    createdAt: b.get('createdAt'),
  };
}

export async function listBroadcasts(creatorId: string) {
  const items = await BroadcastModel.find({ creatorId }).sort({ createdAt: -1 }).limit(100);
  return items.map(publicBroadcast);
}

/**
 * Create a broadcast and hand the actual fan-out to a single durable
 * `broadcast_send` job. The job runner gives us atomic claiming + retry, so a
 * crash mid-send is resumed automatically; the per-recipient enqueue is keyed by
 * (broadcastId, email), so a resume never double-sends. Returns immediately with
 * the broadcast in `sending` state (the job flips it to `sent`).
 */
export async function sendBroadcast(
  creatorId: string,
  input: { subject: string; bodyText: string; bodyHtml?: string; segment: Segment; scheduledAt?: string; repeat?: Repeat },
) {
  if (!input.subject.trim() || !input.bodyText.trim()) {
    throw AppError.badRequest('Subject and body are required');
  }
  const recipients = await resolveRecipients(creatorId, input.segment);
  const repeat: Repeat = input.repeat ?? 'none';
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const isScheduled = scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now();

  const broadcast = await BroadcastModel.create({
    creatorId,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml ?? '',
    segment: input.segment,
    status: isScheduled ? 'scheduled' : 'sending',
    scheduledAt: isScheduled ? scheduledAt : undefined,
    repeat,
    recipientCount: recipients.length,
  });

  const runAt = isScheduled ? scheduledAt! : new Date();
  const occurrence = runAt.toISOString();
  await enqueueJob(
    'broadcast_send',
    { broadcastId: broadcast.id, occurrence },
    { runAt, dedupeKey: `broadcast_send:${broadcast.id}:${occurrence}` },
  );

  recordAudit({
    action: isScheduled ? 'broadcast.scheduled' : 'broadcast.queued',
    actorId: creatorId,
    actorType: 'user',
    creatorId,
    metadata: { segment: input.segment, recipients: recipients.length, scheduledAt: occurrence, repeat },
  });
  return publicBroadcast(broadcast);
}

/** Cancel a scheduled broadcast: stop its pending job and mark it canceled. */
export async function cancelBroadcast(creatorId: string, broadcastId: string) {
  const broadcast = await BroadcastModel.findOne({ _id: broadcastId, creatorId });
  if (!broadcast) throw AppError.notFound('Broadcast not found');
  if (broadcast.status !== 'scheduled') throw AppError.badRequest('Only scheduled broadcasts can be cancelled');
  await JobModel.deleteMany({ type: 'broadcast_send', status: 'pending', 'payload.broadcastId': broadcast.id });
  broadcast.status = 'canceled';
  broadcast.repeat = 'none';
  await broadcast.save();
  return publicBroadcast(broadcast);
}

/**
 * Resumable, idempotent fan-out for a broadcast. Safe to run multiple times: an
 * already-sent broadcast is a no-op, and each recipient's email job carries a
 * unique dedupeKey so a retry after a partial run never duplicates a send.
 */
export async function processBroadcastSend(payload: Record<string, unknown>): Promise<void> {
  const broadcastId = String(payload.broadcastId ?? '');
  if (!broadcastId) return;
  // `occurrence` distinguishes recurring sends so per-recipient dedupe keys don't
  // block the next week's/month's delivery.
  const occurrence = String(payload.occurrence ?? 'once');
  const broadcast = await BroadcastModel.findById(broadcastId);
  if (!broadcast || broadcast.status === 'sent' || broadcast.status === 'canceled') return;

  const creatorId = String(broadcast.creatorId);
  const repeat = (broadcast.get('repeat') ?? 'none') as Repeat;
  const profile = await CreatorProfileModel.findOne({ userId: creatorId }).select('displayName username');
  const recipients = await resolveRecipients(creatorId, broadcast.segment);

  for (const r of recipients) {
    const t = unsubscribeToken(creatorId, r.email);
    const unsubscribeUrl = `${env.APP_URL}/unsubscribe?c=${creatorId}&e=${encodeURIComponent(r.email)}&t=${t}`;
    await enqueueEmail(
      r.email,
      'broadcast',
      {
        subject: broadcast.subject,
        bodyText: broadcast.bodyText,
        bodyHtml: broadcast.bodyHtml ?? '',
        fromName: profile?.displayName || profile?.username || 'CreatorStore',
        unsubscribeUrl,
      },
      { dedupeKey: `broadcast:${broadcastId}:${occurrence}:${r.email.toLowerCase()}` },
    );
  }

  broadcast.sentAt = new Date();
  broadcast.recipientCount = recipients.length;

  // Recurring: schedule the next occurrence instead of marking done.
  const base = broadcast.get('scheduledAt') ?? new Date();
  const next = nextOccurrence(base, repeat);
  if (repeat !== 'none' && next) {
    broadcast.set('scheduledAt', next);
    broadcast.status = 'scheduled';
    await broadcast.save();
    const occ = next.toISOString();
    await enqueueJob(
      'broadcast_send',
      { broadcastId, occurrence: occ },
      { runAt: next, dedupeKey: `broadcast_send:${broadcastId}:${occ}` },
    );
  } else {
    broadcast.status = 'sent';
    await broadcast.save();
  }

  recordAudit({
    action: 'broadcast.sent',
    actorType: 'system',
    creatorId,
    metadata: { segment: broadcast.segment, recipients: recipients.length, occurrence, repeat },
  });
}

/** Register the broadcast job handler with the runner (called at boot). */
export function registerBroadcastJobs(): void {
  registerJobHandler('broadcast_send', processBroadcastSend);
}

/**
 * HMAC token binding an unsubscribe link to (creatorId, email) so the public
 * endpoint can't be abused to unsubscribe arbitrary contacts.
 */
export function unsubscribeToken(creatorId: string, email: string): string {
  return crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${creatorId}:${email.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

function verifyUnsubscribeToken(creatorId: string, email: string, token: string): boolean {
  const expected = unsubscribeToken(creatorId, email);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Unsubscribe a contact (used by the public unsubscribe link). */
export async function unsubscribe(creatorId: string, email: string, token: string): Promise<void> {
  if (!verifyUnsubscribeToken(creatorId, email, token)) {
    throw AppError.badRequest('Invalid or expired unsubscribe link');
  }
  await LeadModel.updateOne(
    { creatorId, email: email.toLowerCase() },
    { $set: { unsubscribedAt: new Date() } },
  );
}
