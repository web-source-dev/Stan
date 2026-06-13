import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { BroadcastModel, type Segment, type BroadcastDoc } from '../../models/Broadcast';
import { LeadModel } from '../../models/Lead';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';

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
 * Create and immediately send a broadcast to a segment by enqueuing one durable
 * send_email job per recipient. Returns the recipient count.
 */
export async function sendBroadcast(
  creatorId: string,
  input: { subject: string; bodyText: string; bodyHtml?: string; segment: Segment },
) {
  if (!input.subject.trim() || !input.bodyText.trim()) {
    throw AppError.badRequest('Subject and body are required');
  }
  const profile = await CreatorProfileModel.findOne({ userId: creatorId }).select('displayName username');
  const recipients = await resolveRecipients(creatorId, input.segment);

  const broadcast = await BroadcastModel.create({
    creatorId,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml ?? '',
    segment: input.segment,
    status: 'sending',
    recipientCount: recipients.length,
  });

  for (const r of recipients) {
    const unsubscribeUrl = `${env.APP_URL}/unsubscribe?c=${creatorId}&e=${encodeURIComponent(r.email)}`;
    await enqueueEmail(r.email, 'broadcast', {
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? '',
      fromName: profile?.displayName || profile?.username || 'CreatorStore',
      unsubscribeUrl,
    });
  }

  broadcast.status = 'sent';
  broadcast.sentAt = new Date();
  await broadcast.save();
  recordAudit({
    action: 'broadcast.sent',
    actorId: creatorId,
    actorType: 'user',
    creatorId,
    metadata: { segment: input.segment, recipients: recipients.length },
  });
  return publicBroadcast(broadcast);
}

/** Unsubscribe a contact (used by the public unsubscribe link). */
export async function unsubscribe(creatorId: string, email: string): Promise<void> {
  await LeadModel.updateOne(
    { creatorId, email: email.toLowerCase() },
    { $set: { unsubscribedAt: new Date() } },
  );
}
