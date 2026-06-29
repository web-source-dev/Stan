import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { IntegrationModel, type IntegrationDoc } from '../../models/Integration';
import { AutoDMRuleModel } from '../../models/AutoDMRule';

/**
 * Instagram AutoDM integration — "Instagram API with Instagram Login" flow
 * (the same one stan.store uses).
 *
 * Real mode (Instagram App ID/Secret present): the creator authorizes with their
 * Instagram credentials directly (no Facebook Page), we exchange the code for a
 * long-lived Instagram user token, store it, and deliver replies through the
 * Instagram Graph API in response to signed webhook events.
 *
 * Simulation mode (no credentials): the same keyword-matching engine runs, but
 * replies are logged instead of sent — so the feature is fully testable locally
 * and goes live the moment credentials are configured.
 */

// Instagram Login uses its own Graph host (graph.instagram.com), distinct from
// the Facebook Graph host used by the Facebook-login flow.
const GRAPH = `https://graph.instagram.com`;
const GRAPH_VERSIONED = `${GRAPH}/${env.INSTAGRAM_GRAPH_VERSION}`;

// Scopes for the Instagram Login messaging API. These are the same three the
// real Stan requests (instagram_business_* family — note: NOT the instagram_*
// / pages_* family used by the Facebook-login flow).
const OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
].join(',');

const STATE_TTL = '15m';

export type AutoReplySource = 'dm' | 'comment' | 'simulation';

export interface AutoReplyResult {
  matched: boolean;
  ruleId?: string;
  keyword?: string;
  reply?: string;
  delivery: 'sent' | 'simulated' | 'skipped';
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* OAuth                                                               */
/* ------------------------------------------------------------------ */

/** Signed, short-lived state param so the OAuth callback can trust the creator. */
export function signOAuthState(creatorId: string): string {
  return jwt.sign({ creatorId, purpose: 'ig_oauth' }, env.JWT_ACCESS_SECRET, { expiresIn: STATE_TTL });
}

export function verifyOAuthState(state: string): string {
  const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as { creatorId: string; purpose: string };
  if (decoded.purpose !== 'ig_oauth' || !decoded.creatorId) throw new Error('Invalid OAuth state');
  return decoded.creatorId;
}

/** Build the Instagram OAuth consent URL the creator is redirected to. */
export function buildLoginUrl(creatorId: string): string {
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    state: signOAuthState(creatorId),
    scope: OAUTH_SCOPES,
    response_type: 'code',
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

interface LinkedAccount {
  accountName: string;
  /** The Instagram professional account id used to send messages and map webhooks. */
  igAccountId: string;
  /** Long-lived Instagram user access token (authorizes sends for this account). */
  accessToken: string;
  expiresAt?: Date;
}

/**
 * Exchange the OAuth code for a long-lived Instagram user token, then read the
 * account's id + username. The user token authorizes messaging/comment sends for
 * the creator's own Instagram professional account — no Facebook Page involved.
 */
export async function exchangeCodeForAccount(code: string): Promise<LinkedAccount> {
  // 1. code -> short-lived user token (form-encoded POST to api.instagram.com).
  //    Instagram strips a trailing "#_" fragment marker onto codes in some
  //    flows; defensively drop it.
  const cleanCode = code.replace(/#_$/, '');
  const form = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    client_secret: env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    code: cleanCode,
  });
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const shortBody = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    user_id?: string | number;
    // Newer responses may wrap the payload in a `data` array.
    data?: { access_token?: string; user_id?: string | number }[];
    error_message?: string;
    error_type?: string;
  };
  const shortToken = shortBody.access_token ?? shortBody.data?.[0]?.access_token;
  if (!shortRes.ok || !shortToken) {
    throw new Error(`Instagram code exchange failed: ${shortBody.error_message ?? shortRes.status}`);
  }

  // 2. short-lived -> long-lived user token (~60 days).
  const longUrl =
    `${GRAPH}/access_token?` +
    new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: env.INSTAGRAM_APP_SECRET,
      access_token: shortToken,
    }).toString();
  const longRes = await fetch(longUrl);
  const longBody = (await longRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!longRes.ok || !longBody.access_token) {
    throw new Error(`Instagram long-lived token exchange failed: ${longBody.error?.message ?? longRes.status}`);
  }
  const accessToken = longBody.access_token;
  const expiresAt = longBody.expires_in ? new Date(Date.now() + longBody.expires_in * 1000) : undefined;

  // 3. read the account id + username with the long-lived token.
  const meUrl =
    `${GRAPH}/me?` +
    new URLSearchParams({ fields: 'user_id,username', access_token: accessToken }).toString();
  const meRes = await fetch(meUrl);
  const me = (await meRes.json().catch(() => ({}))) as {
    user_id?: string | number;
    username?: string;
    id?: string;
    error?: { message?: string };
  };
  const igAccountId = String(me.user_id ?? me.id ?? shortBody.user_id ?? shortBody.data?.[0]?.user_id ?? '');
  if (!meRes.ok || !igAccountId) {
    throw new Error(`Instagram profile lookup failed: ${me.error?.message ?? meRes.status}`);
  }

  return {
    accountName: me.username || 'Instagram',
    igAccountId,
    accessToken,
    expiresAt,
  };
}

/** Persist a completed Instagram connection for a creator. */
export async function persistConnection(creatorId: string, account: LinkedAccount): Promise<IntegrationDoc> {
  let doc = await IntegrationModel.findOne({ creatorId, provider: 'instagram' });
  if (!doc) doc = new IntegrationModel({ creatorId, provider: 'instagram' });
  doc.status = 'connected';
  doc.accountName = account.accountName;
  doc.externalAccountId = account.igAccountId;
  doc.connectedAt = new Date();
  doc.tokenExpiresAt = account.expiresAt;
  doc.set('accessToken', account.accessToken);
  await doc.save();
  return doc;
}

/* ------------------------------------------------------------------ */
/* Webhook signature                                                   */
/* ------------------------------------------------------------------ */

/** Verify the X-Hub-Signature-256 header against the raw body using the app secret. */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.INSTAGRAM_APP_SECRET || !signatureHeader) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.INSTAGRAM_APP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Graph API delivery                                                  */
/* ------------------------------------------------------------------ */

async function graphPost(path: string, accessToken: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH_VERSIONED}${path}?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok || body.error) {
    throw new Error(`Graph POST ${path} failed: ${body.error?.message ?? res.status}`);
  }
}

/** Send an Instagram DM to a sender (IGSID) from the connected business account. */
export async function sendDirectMessage(
  igAccountId: string,
  accessToken: string,
  recipientId: string,
  text: string,
): Promise<void> {
  await graphPost(`/${igAccountId}/messages`, accessToken, {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: 'RESPONSE',
  });
}

/** Reply publicly to a comment. */
export async function replyToComment(commentId: string, accessToken: string, text: string): Promise<void> {
  await graphPost(`/${commentId}/replies`, accessToken, { message: text });
}

/**
 * Send a private reply (DM) to the author of a comment, addressed by the comment
 * id. This is the Instagram "private replies" API — it lets the business DM a
 * commenter without them having messaged first (within a 7-day window).
 */
export async function sendPrivateReply(
  igAccountId: string,
  accessToken: string,
  commentId: string,
  text: string,
): Promise<void> {
  await graphPost(`/${igAccountId}/messages`, accessToken, {
    recipient: { comment_id: commentId },
    message: { text },
  });
}

/* ------------------------------------------------------------------ */
/* Media (for the comment-automation post picker)                      */
/* ------------------------------------------------------------------ */

export interface AccountMedia {
  id: string;
  caption: string;
  mediaType: string;
  thumbnail: string;
  permalink: string;
}

/**
 * Fetch the connected account's recent posts so the creator can scope a
 * comment-automation rule to a specific post. Returns [] when the account isn't
 * connected (or credentials are unconfigured) so the UI degrades gracefully.
 */
export async function fetchAccountMedia(creatorId: string, limit = 24): Promise<AccountMedia[]> {
  if (!env.instagramConfigured) return [];
  const integration = await IntegrationModel.findOne({
    creatorId,
    provider: 'instagram',
    status: 'connected',
  }).select('+accessToken');
  const token = integration?.get('accessToken') as string | undefined;
  if (!integration || !token) return [];

  const url =
    `${GRAPH_VERSIONED}/me/media?` +
    new URLSearchParams({
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink',
      limit: String(limit),
      access_token: token,
    }).toString();
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      id?: string;
      caption?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
    }[];
    error?: { message?: string };
  };
  if (!res.ok || body.error) {
    throw new Error(`Instagram media fetch failed: ${body.error?.message ?? res.status}`);
  }
  return (body.data ?? []).map((m) => ({
    id: String(m.id ?? ''),
    caption: m.caption ?? '',
    mediaType: m.media_type ?? '',
    // Video posts expose a thumbnail_url; images use media_url.
    thumbnail: m.thumbnail_url || m.media_url || '',
    permalink: m.permalink ?? '',
  }));
}

/* ------------------------------------------------------------------ */
/* Keyword engine                                                      */
/* ------------------------------------------------------------------ */

/** Compose the outgoing reply text, appending the rule's link when present. */
function composeReply(reply: string, linkUrl?: string): string {
  return linkUrl ? `${reply}\n${linkUrl}` : reply;
}

/** Whole-word, case-insensitive keyword match (so "LINK" matches "drop the LINK!"). */
function keywordMatches(text: string, keyword: string): boolean {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i').test(text);
}

interface RunAutoReplyInput {
  creatorId: string;
  platform?: 'instagram' | 'tiktok';
  text: string;
  /** IGSID (for DM) or comment id (for comment); omitted in simulation. */
  targetId?: string;
  /** The post id a comment was left on — used to scope post-specific rules. */
  mediaId?: string;
  source: AutoReplySource;
}

/**
 * Core engine shared by the live webhook and the local simulate endpoint:
 * find the first enabled rule whose keyword appears in `text`, deliver the
 * reply (real Graph API call when connected + targeted, otherwise logged), and
 * increment the rule's triggeredCount.
 */
export async function runAutoReply(input: RunAutoReplyInput): Promise<AutoReplyResult> {
  const platform = input.platform ?? 'instagram';
  const rules = await AutoDMRuleModel.find({ creatorId: input.creatorId, platform, enabled: true });
  const rule = rules.find((r) => {
    if (!keywordMatches(input.text, r.keyword)) return false;
    // Post scoping applies only to real comment events: a rule pinned to a
    // specific post must not fire on comments from other posts. Simulation and
    // DMs are never post-scoped.
    if (input.source === 'comment' && r.mediaId && input.mediaId && r.mediaId !== input.mediaId) {
      return false;
    }
    return true;
  });
  if (!rule) return { matched: false, delivery: 'skipped', detail: 'No enabled rule matched the message' };

  const replyText = composeReply(rule.reply, rule.linkUrl);
  let delivery: AutoReplyResult['delivery'] = 'simulated';
  let detail: string | undefined;

  const canSendLive =
    env.instagramConfigured && input.source !== 'simulation' && Boolean(input.targetId);

  if (canSendLive) {
    const integration = await IntegrationModel.findOne({
      creatorId: input.creatorId,
      provider: 'instagram',
      status: 'connected',
    }).select('+accessToken externalAccountId');
    const token = integration?.get('accessToken') as string | undefined;
    if (integration && token) {
      try {
        if (input.source === 'comment') {
          if (rule.dmOnComment) {
            // Comment-to-DM: privately message the commenter with the payload,
            // and optionally post a short public acknowledgement under the comment.
            await sendPrivateReply(integration.externalAccountId, token, input.targetId!, replyText);
            const ack = rule.publicReply?.trim();
            if (ack) await replyToComment(input.targetId!, token, ack);
          } else {
            await replyToComment(input.targetId!, token, replyText);
          }
        } else {
          await sendDirectMessage(integration.externalAccountId, token, input.targetId!, replyText);
        }
        delivery = 'sent';
      } catch (err) {
        delivery = 'skipped';
        detail = err instanceof Error ? err.message : String(err);
        logger.error({ err, ruleId: rule.id }, 'Instagram reply delivery failed');
      }
    } else {
      delivery = 'skipped';
      detail = 'Instagram is not connected for this creator';
    }
  } else {
    logger.info(
      { to: input.targetId ?? '(simulation)', keyword: rule.keyword, reply: replyText },
      '[instagram:dev] auto-reply (not sent — simulation/unconfigured)',
    );
  }

  if (delivery !== 'skipped') {
    rule.triggeredCount += 1;
    await rule.save();
  }

  return { matched: true, ruleId: rule.id, keyword: rule.keyword, reply: replyText, delivery, detail };
}

/** Resolve a creator from an inbound webhook's Instagram business account id. */
export async function creatorIdForIgAccount(igAccountId: string): Promise<string | null> {
  const doc = await IntegrationModel.findOne({ provider: 'instagram', externalAccountId: igAccountId });
  return doc ? String(doc.creatorId) : null;
}

/**
 * Refresh a long-lived Instagram user token (~60 days). Marks the integration
 * disconnected when refresh fails so the creator is prompted to reconnect.
 */
export async function refreshLongLivedToken(integration: IntegrationDoc): Promise<boolean> {
  const token = integration.get('accessToken') as string | undefined;
  if (!token) {
    integration.status = 'disconnected';
    await integration.save();
    return false;
  }

  const url =
    `${GRAPH}/refresh_access_token?` +
    new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token }).toString();
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!res.ok || !body.access_token) {
    logger.warn(
      { integrationId: integration.id, err: body.error?.message },
      'Instagram token refresh failed — disconnecting',
    );
    integration.status = 'disconnected';
    integration.set('accessToken', '');
    integration.externalAccountId = '';
    integration.tokenExpiresAt = undefined;
    await integration.save();
    return false;
  }

  integration.set('accessToken', body.access_token);
  integration.tokenExpiresAt = body.expires_in
    ? new Date(Date.now() + body.expires_in * 1000)
    : undefined;
  await integration.save();
  return true;
}

/** Whether this integration has a real OAuth token (live delivery), not demo-only. */
export function isLiveInstagramConnection(doc: IntegrationDoc | null | undefined): boolean {
  return Boolean(env.instagramConfigured && doc?.status === 'connected' && doc.externalAccountId);
}
