import type { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { WebhookEventModel } from '../../models/WebhookEvent';
import {
  verifyWebhookSignature,
  creatorIdForIgAccount,
  runAutoReply,
  type AutoReplySource,
} from '../integrations/instagram.service';

/**
 * GET handshake: Meta calls this once when you subscribe the webhook. Echo back
 * hub.challenge only if the verify token matches the one configured in .env.
 */
export function verifyInstagramWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(String(challenge));
    return;
  }
  res.sendStatus(403);
}

interface IgChange {
  field?: string;
  value?: {
    text?: string;
    from?: { id?: string };
    id?: string; // comment id
    media?: { id?: string }; // the post the comment was left on
  };
}
interface IgMessaging {
  sender?: { id?: string };
  message?: { text?: string };
}
interface IgEntry {
  id?: string; // Instagram business account id
  changes?: IgChange[];
  messaging?: IgMessaging[];
}

interface ExtractedEvent {
  source: AutoReplySource;
  text: string;
  targetId?: string;
  mediaId?: string;
}

/** Normalise a single entry into the fields the engine needs. */
function extractEvents(entry: IgEntry): ExtractedEvent[] {
  const out: ExtractedEvent[] = [];
  for (const m of entry.messaging ?? []) {
    if (m.message?.text) out.push({ source: 'dm', text: m.message.text, targetId: m.sender?.id });
  }
  for (const c of entry.changes ?? []) {
    if (c.field === 'comments' && c.value?.text) {
      out.push({ source: 'comment', text: c.value.text, targetId: c.value.id, mediaId: c.value.media?.id });
    }
  }
  return out;
}

/**
 * POST receiver. Mounted with a raw body so the HMAC signature can be verified.
 * Acks fast, then matches keywords and delivers replies via the Graph API.
 */
export async function handleInstagramWebhook(req: Request, res: Response): Promise<void> {
  const raw = req.body as Buffer;
  if (!verifyWebhookSignature(raw, req.headers['x-hub-signature-256'] as string | undefined)) {
    logger.warn('Instagram webhook signature verification failed');
    res.sendStatus(403);
    return;
  }

  let payload: { object?: string; entry?: IgEntry[] };
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    res.sendStatus(400);
    return;
  }

  // Idempotency: derive a stable id from the body hash (Meta has no global event id).
  const eventId = crypto.createHash('sha256').update(raw).digest('hex');
  try {
    await WebhookEventModel.create({ provider: 'instagram', eventId, type: payload.object ?? 'instagram', status: 'received' });
  } catch {
    res.json({ received: true, duplicate: true });
    return;
  }

  res.json({ received: true });

  try {
    for (const entry of payload.entry ?? []) {
      const igAccountId = entry.id;
      if (!igAccountId) continue;
      const creatorId = await creatorIdForIgAccount(igAccountId);
      if (!creatorId) {
        logger.warn({ igAccountId }, 'Instagram webhook for an unmapped account');
        continue;
      }
      for (const ev of extractEvents(entry)) {
        await runAutoReply({ creatorId, platform: 'instagram', ...ev });
      }
    }
    await WebhookEventModel.updateOne(
      { provider: 'instagram', eventId },
      { $set: { status: 'processed', processedAt: new Date() }, $inc: { attempts: 1 } },
    );
  } catch (err) {
    logger.error({ err }, 'Instagram webhook processing failed');
    await WebhookEventModel.updateOne(
      { provider: 'instagram', eventId },
      { $set: { status: 'failed', lastError: err instanceof Error ? err.message : String(err) }, $inc: { attempts: 1 } },
    );
  }
}
