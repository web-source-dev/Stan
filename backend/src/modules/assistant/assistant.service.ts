import { Types } from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { OrderModel } from '../../models/Order';
import { UserModel } from '../../models/User';
import { getOwnProfile } from '../creator/creator.service';
import { listProducts, createProduct } from '../products/products.service';
import { leadStats } from '../leads/leads.service';
import { summary as analyticsSummary } from '../analytics/analytics.service';
import { canAcceptPayments } from '../payments/connect.service';

export interface SetupTask { key: string; label: string; done: boolean; href: string }

/** The onboarding checklist — what the creator still needs to do to start selling. */
export async function setupChecklist(creatorId: string): Promise<{ tasks: SetupTask[]; completed: number; total: number }> {
  const [profile, products, user, paymentsReady] = await Promise.all([
    getOwnProfile(creatorId),
    listProducts(creatorId),
    UserModel.findById(creatorId),
    canAcceptPayments(creatorId).catch(() => false),
  ]);
  const tasks: SetupTask[] = [
    { key: 'profile', label: 'Complete your profile', done: Boolean(profile?.displayName), href: '/dashboard/settings?tab=profile' },
    { key: 'product', label: 'Add your first product', done: products.length > 0, href: '/dashboard/products/new' },
    { key: 'payments', label: 'Set up Direct Deposit', done: paymentsReady, href: '/dashboard/settings?tab=payments' },
    { key: 'publish', label: 'Publish your store', done: Boolean(profile?.published), href: '/dashboard/storefront' },
    { key: 'email', label: 'Verify your email', done: Boolean(user?.emailVerified), href: '/dashboard/settings' },
  ];
  return { tasks, completed: tasks.filter((t) => t.done).length, total: tasks.length };
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatResult { reply: string; action?: { type: 'navigate'; href: string; label: string } }

const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------ */
/* Tools — the assistant's window into (and hands on) the store        */
/* ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'get_account_overview',
    description: "A snapshot of the creator's store: display name, username, published status, last-30-day revenue and orders, number of live/total products, and audience size.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_analytics',
    description: 'Traffic and conversion analytics for the store over the last N days (store visits, leads captured, orders, revenue, and conversion rates).',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Lookback window in days. Defaults to 30.' } } },
  },
  {
    name: 'list_products',
    description: "List the creator's products with id, title, type, status and price.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_orders',
    description: 'List the most recent orders (product, buyer email, amount, status, date).',
    input_schema: { type: 'object', properties: { limit: { type: 'number', description: 'Max orders to return (default 10).' } } },
  },
  {
    name: 'create_product',
    description: 'Create a new DRAFT product the creator can then edit and publish. Only the title is required. Use type "digital" for a paid download or "lead_magnet" for a free opt-in. Always confirm the created product and share that it is a draft.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Product title.' },
        type: { type: 'string', enum: ['digital', 'lead_magnet'], description: 'digital = paid, lead_magnet = free opt-in.' },
        priceCents: { type: 'number', description: 'Price in cents, e.g. 1999 for $19.99. Use 0 for free.' },
        description: { type: 'string', description: 'Short product description.' },
      },
      required: ['title'],
    },
  },
];

async function runTool(creatorId: string, name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_account_overview': {
      const profile = await getOwnProfile(creatorId);
      const since = new Date(Date.now() - 30 * 864e5);
      const cid = new Types.ObjectId(creatorId);
      const [agg] = await OrderModel.aggregate([
        { $match: { creatorId: cid, status: 'paid', paidAt: { $gte: since } } },
        { $group: { _id: null, revenueCents: { $sum: '$amountCents' }, orders: { $sum: 1 } } },
      ]);
      const products = await listProducts(creatorId);
      const leads = await leadStats(creatorId);
      return {
        displayName: profile?.displayName ?? '',
        username: profile?.username ?? '',
        published: profile?.published ?? false,
        revenueCents30d: agg?.revenueCents ?? 0,
        orders30d: agg?.orders ?? 0,
        liveProducts: products.filter((p) => p.status === 'published').length,
        totalProducts: products.length,
        audience: leads.total,
      };
    }
    case 'get_analytics':
      return analyticsSummary(creatorId, { days: typeof input.days === 'number' ? input.days : 30 });
    case 'list_products': {
      const ps = await listProducts(creatorId);
      return ps.map((p) => ({ id: p.id, title: p.title, type: p.type, status: p.status, priceCents: p.priceCents }));
    }
    case 'get_recent_orders': {
      const limit = Math.min(typeof input.limit === 'number' ? input.limit : 10, 50);
      const orders = await OrderModel.find({ creatorId }).sort({ createdAt: -1 }).limit(limit).populate('productId', 'title');
      return orders.map((o) => ({
        product: (o.productId as unknown as { title?: string })?.title ?? '',
        buyerEmail: o.buyerEmail,
        amountCents: o.amountCents,
        status: o.status,
        at: o.get('createdAt'),
      }));
    }
    case 'create_product': {
      const p = await createProduct(creatorId, {
        title: String(input.title),
        type: input.type === 'lead_magnet' ? 'lead_magnet' : 'digital',
        priceCents: typeof input.priceCents === 'number' ? input.priceCents : 0,
        description: typeof input.description === 'string' ? input.description : undefined,
      });
      return { id: p.id, title: p.title, status: p.status, editUrl: `/dashboard/products/${p.id}/edit` };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/* ------------------------------------------------------------------ */
/* Anthropic agent loop                                                */
/* ------------------------------------------------------------------ */

const SYSTEM = `You are Stanley, the friendly AI creator-coach built into Stan — a platform where creators sell digital products, courses, bookings and run their audience.
You help the logged-in creator manage and grow their store. You can answer questions about their analytics, revenue, products, orders and audience, and you can take actions like creating products.
Always use the available tools to fetch the creator's real data before answering questions about their account — never invent numbers. When you take an action (e.g. create a product), clearly confirm what you did and mention it's a draft they can edit.
Be concise, warm and practical. Format money as $X.XX. When a created product or page can be opened, mention it. If asked to do something you don't have a tool for, explain what they can do in the app instead.`;

interface AnthropicBlock { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }
interface AnthropicResponse { stop_reason: string; content: AnthropicBlock[] }

async function callAnthropic(messages: unknown[]): Promise<AnthropicResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: env.ASSISTANT_MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}: ${await res.text()}`);
  return res.json() as Promise<AnthropicResponse>;
}

async function agentChat(creatorId: string, history: ChatMessage[]): Promise<ChatResult> {
  const messages: unknown[] = history.map((m) => ({ role: m.role, content: m.content }));
  let createdHref: string | undefined;

  for (let step = 0; step < 6; step++) {
    const resp = await callAnthropic(messages);
    if (resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: resp.content });
      const toolResults: unknown[] = [];
      for (const block of resp.content) {
        if (block.type === 'tool_use' && block.name) {
          let result: unknown;
          try {
            result = await runTool(creatorId, block.name, block.input ?? {});
            if (block.name === 'create_product') createdHref = (result as { editUrl?: string }).editUrl;
          } catch (e) {
            result = { error: e instanceof Error ? e.message : 'tool failed' };
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }
    const text = (resp.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
    return {
      reply: text || "I'm not sure how to help with that — could you rephrase?",
      action: createdHref ? { type: 'navigate', href: createdHref, label: 'Open product' } : undefined,
    };
  }
  return { reply: 'That took more steps than expected — try asking in a simpler way.' };
}

/* ------------------------------------------------------------------ */
/* Deterministic fallback (no API key) — still answers from live data  */
/* ------------------------------------------------------------------ */

async function fallbackChat(creatorId: string, history: ChatMessage[]): Promise<ChatResult> {
  const last = (history[history.length - 1]?.content ?? '').toLowerCase();

  if (/analytic|traffic|views?|visit|conversion|leads?/.test(last)) {
    const a = (await runTool(creatorId, 'get_analytics', {})) as { days: number; views: number; leadSubmits: number; orders: number; revenueCents: number; visitToCheckoutRate: number; checkoutToOrderRate: number };
    return { reply: `Over the last ${a.days} days: ${a.views} store visit(s), ${a.leadSubmits} lead(s), ${a.orders} order(s) and ${fmt(a.revenueCents)} in revenue. Conversion: visit→checkout ${a.visitToCheckoutRate}%, checkout→order ${a.checkoutToOrderRate}%.`, action: { type: 'navigate', href: '/dashboard/analytics', label: 'Open Analytics' } };
  }
  if (/revenue|sales|income|earn|orders?|how.*(doing|store|going)|overview|summary|account|snapshot/.test(last)) {
    const o = (await runTool(creatorId, 'get_account_overview', {})) as { displayName: string; revenueCents30d: number; orders30d: number; liveProducts: number; audience: number; published: boolean };
    return { reply: `${o.displayName ? `${o.displayName.split(' ')[0]}, here` : 'Here'}'s your snapshot: ${fmt(o.revenueCents30d)} revenue and ${o.orders30d} order(s) in the last 30 days, ${o.liveProducts} live product(s), and ${o.audience} contact(s). Your store is ${o.published ? 'published ✅' : 'in draft — publish it to start selling.'}` };
  }
  if (/product/.test(last)) {
    const ps = (await runTool(creatorId, 'list_products', {})) as { title: string; status: string }[];
    if (/creat|add|new|make|build/.test(last)) {
      return { reply: `Let's add a product! Open the product builder and I'll help you fill it in. You currently have ${ps.length} product(s).`, action: { type: 'navigate', href: '/dashboard/products/new', label: 'Add a product' } };
    }
    return ps.length
      ? { reply: `You have ${ps.length} product(s): ${ps.slice(0, 6).map((p) => `“${p.title}” (${p.status})`).join(', ')}.`, action: { type: 'navigate', href: '/dashboard/products', label: 'Manage products' } }
      : { reply: "You don't have any products yet. Want to create your first one?", action: { type: 'navigate', href: '/dashboard/products/new', label: 'Add a product' } };
  }
  return {
    reply: "Hi! I'm Stanley, your AI creator coach. I can help with your analytics, products, orders and audience. Try: “How's my store doing?”, “Show my analytics”, or “List my products”.\n\nTip: full conversational AI (free-form questions + creating products by chat) activates once an ANTHROPIC_API_KEY is set on the server. For now I answer straight from your live store data.",
  };
}

export async function chat(creatorId: string, history: ChatMessage[]): Promise<ChatResult> {
  if (!env.aiConfigured) return fallbackChat(creatorId, history);
  try {
    return await agentChat(creatorId, history);
  } catch (err) {
    logger.error({ err }, 'Stanley agent failed — using fallback');
    return fallbackChat(creatorId, history);
  }
}
