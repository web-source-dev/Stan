import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { IntegrationModel, type IntegrationDoc } from '../../models/Integration';
import { AutoDMRuleModel } from '../../models/AutoDMRule';

/**
 * Instagram AutoDM integration.
 *
 * Real mode (Meta App ID/Secret present): completes Facebook Login OAuth,
 * discovers the linked Instagram business account, stores the page token, and
 * delivers replies through the Graph API in response to signed webhook events.
 *
 * Simulation mode (no Meta credentials): the same keyword-matching engine runs,
 * but replies are logged instead of sent — so the feature is fully testable
 * locally and goes live the moment credentials are configured.
 */

const GRAPH = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

// Permissions needed to read comments/messages and reply on the creator's behalf.
const OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'instagram_manage_comments',
  'pages_show_list',
  'pages_manage_metadata',
  'business_management',
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

/** Build the Facebook OAuth consent URL the creator is redirected to. */
export function buildLoginUrl(creatorId: string): string {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: env.META_OAUTH_REDIRECT_URI,
    state: signOAuthState(creatorId),
    scope: OAUTH_SCOPES,
    response_type: 'code',
  });
  return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}${path}?${qs}`);
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || body.error) {
    throw new Error(`Graph GET ${path} failed: ${body.error?.message ?? res.status}`);
  }
  return body;
}

interface LinkedAccount {
  accountName: string;
  igAccountId: string;
  pageId: string;
  pageAccessToken: string;
  expiresAt?: Date;
}

/**
 * Exchange the OAuth code for a long-lived token, then find the first Facebook
 * Page that has an Instagram business account attached and return its page
 * token (which authorizes messaging/comment sends for that IG account).
 */
export async function exchangeCodeForAccount(code: string): Promise<LinkedAccount> {
  // 1. code -> short-lived user token
  const shortTok = await graphGet<{ access_token: string }>('/oauth/access_token', {
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: env.META_OAUTH_REDIRECT_URI,
    code,
  });

  // 2. short-lived -> long-lived user token (~60 days)
  const longTok = await graphGet<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: shortTok.access_token,
  });
  const expiresAt = longTok.expires_in ? new Date(Date.now() + longTok.expires_in * 1000) : undefined;

  // 3. list pages with their IG business account + page tokens
  const pages = await graphGet<{
    data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
  }>('/me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    access_token: longTok.access_token,
  });

  const page = pages.data.find((p) => p.instagram_business_account?.id);
  if (!page || !page.instagram_business_account) {
    throw new Error('No Instagram business account is linked to your Facebook Pages. Link one in Meta Business settings and try again.');
  }

  return {
    accountName: page.instagram_business_account.username || page.name,
    igAccountId: page.instagram_business_account.id,
    pageId: page.id,
    pageAccessToken: page.access_token,
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
  doc.pageId = account.pageId;
  doc.connectedAt = new Date();
  doc.tokenExpiresAt = account.expiresAt;
  doc.set('accessToken', account.pageAccessToken);
  await doc.save();
  return doc;
}

/* ------------------------------------------------------------------ */
/* Webhook signature                                                   */
/* ------------------------------------------------------------------ */

/** Verify the X-Hub-Signature-256 header against the raw body using the app secret. */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.META_APP_SECRET || !signatureHeader) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Graph API delivery                                                  */
/* ------------------------------------------------------------------ */

async function graphPost(path: string, accessToken: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH}${path}?access_token=${encodeURIComponent(accessToken)}`, {
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
  const rule = rules.find((r) => keywordMatches(input.text, r.keyword));
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
          await replyToComment(input.targetId!, token, replyText);
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
