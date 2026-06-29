import { Types } from 'mongoose';
import { env } from '../../config/env';
import { requireStripe } from '../../lib/stripe';
import { AppError } from '../../utils/AppError';
import { OrderModel, type OrderDoc } from '../../models/Order';
import { ProductModel } from '../../models/Product';
import { CourseModel } from '../../models/Course';
import { BookingTypeModel } from '../../models/Booking';
import { WebinarModel } from '../../models/Webinar';
import { EntitlementModel } from '../../models/Entitlement';
import { getConnectedAccountId, refreshStatus } from '../payments/connect.service';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import { resolveCreatorBranding } from '../../lib/creatorNotifications';

export const INCOME_WINDOW_DAYS = 30;

function sinceDate(days = INCOME_WINDOW_DAYS): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Match paid orders whose effective payment date falls in the window. */
function paidInWindowMatch(creatorId: Types.ObjectId, since: Date) {
  return {
    creatorId,
    status: 'paid',
    $expr: { $gte: [{ $ifNull: ['$paidAt', '$createdAt'] }, since] },
  };
}

export async function listCreatorOrders(creatorId: string) {
  const cid = new Types.ObjectId(creatorId);
  const orders = await OrderModel.find({ creatorId: cid }).sort({ paidAt: -1, createdAt: -1 }).limit(500);

  const ids = orders.map((o) => o.get('productId')).filter(Boolean);
  const [products, courses, bookings, webinars] = await Promise.all([
    ProductModel.find({ _id: { $in: ids } }, 'title slug productKind').lean(),
    CourseModel.find({ _id: { $in: ids } }, 'title slug').lean(),
    BookingTypeModel.find({ _id: { $in: ids } }, 'title slug').lean(),
    WebinarModel.find({ _id: { $in: ids } }, 'title slug').lean(),
  ]);
  const items = new Map<string, { title: string; slug: string; kind: string; productKind?: string }>();
  for (const p of products) {
    items.set(String(p._id), { title: p.title, slug: p.slug, kind: 'product', productKind: p.productKind || 'digital' });
  }
  for (const c of courses) items.set(String(c._id), { title: c.title, slug: c.slug, kind: 'course' });
  for (const b of bookings) items.set(String(b._id), { title: b.title, slug: b.slug, kind: 'booking' });
  for (const w of webinars) items.set(String(w._id), { title: w.title, slug: w.slug, kind: 'webinar' });

  return orders.map((o) => {
    const createdAt = o.get('createdAt') as Date;
    const paidAt = (o.paidAt ?? createdAt) as Date;
    const product = items.get(String(o.get('productId'))) ?? null;
    const productKind = product?.productKind ?? '';
    return {
      id: o.id,
      buyerEmail: o.buyerEmail,
      buyerName: o.get('buyerName') ?? '',
      amountCents: o.amountCents,
      currency: o.currency,
      applicationFeeCents: o.applicationFeeCents ?? 0,
      status: o.status,
      fulfilmentStatus: o.fulfilmentStatus,
      discountCode: o.get('discountCode') ?? '',
      paymentProvider: o.get('paymentProvider') || (o.amountCents === 0 ? 'free' : 'stripe'),
      product,
      needsFulfillment: productKind === 'custom' && o.fulfilmentStatus === 'pending' && o.status === 'paid',
      createdAt: createdAt.toISOString(),
      paidAt: paidAt.toISOString(),
    };
  });
}

export async function getCreatorOrder(creatorId: string, orderId: string) {
  const order = await OrderModel.findOne({ _id: orderId, creatorId: new Types.ObjectId(creatorId) });
  if (!order) throw AppError.notFound('Order not found');

  const product = await ProductModel.findOne({ _id: order.productId, creatorId: order.creatorId }).select(
    'title productKind fulfilmentNote customFields',
  );
  if (!product) throw AppError.notFound('Product not found');

  const buyerFields = (order.get('buyerCustomFields') as Record<string, string> | undefined) ?? {};
  const customFields = (product.customFields ?? []).map((f) => ({
    label: f.label,
    value: String(buyerFields[String(f._id)] ?? buyerFields[f.label] ?? ''),
  }));

  return {
    id: order.id,
    buyerEmail: order.buyerEmail,
    buyerName: order.get('buyerName') ?? '',
    amountCents: order.amountCents,
    currency: order.currency,
    status: order.status,
    fulfilmentStatus: order.fulfilmentStatus,
    fulfillmentMessage: order.get('fulfillmentMessage') ?? '',
    fulfillmentDeliveryUrl: order.get('fulfillmentDeliveryUrl') ?? '',
    fulfillmentAssets: (order.get('fulfillmentAssets') as OrderDoc['fulfillmentAssets']) ?? [],
    buyerCustomFields: customFields.filter((f) => f.value),
    product: {
      title: product.title,
      productKind: product.productKind,
      fulfilmentNote: product.fulfilmentNote ?? '',
    },
    paidAt: (order.paidAt ?? order.get('createdAt'))?.toISOString?.() ?? '',
  };
}

export interface FulfillCustomOrderInput {
  message?: string;
  deliveryUrl?: string;
  assets: {
    publicId: string;
    resourceType: 'raw' | 'image' | 'video';
    filename: string;
    bytes: number;
    format: string;
  }[];
}

export async function fulfillCustomOrder(creatorId: string, orderId: string, input: FulfillCustomOrderInput) {
  const order = await OrderModel.findOne({ _id: orderId, creatorId: new Types.ObjectId(creatorId) });
  if (!order) throw AppError.notFound('Order not found');
  if (order.status !== 'paid') throw AppError.badRequest('Only paid orders can be fulfilled.');
  if (order.fulfilmentStatus === 'fulfilled') throw AppError.badRequest('This order is already fulfilled.');

  const product = await ProductModel.findOne({ _id: order.productId, creatorId: order.creatorId });
  if (!product) throw AppError.notFound('Product not found');
  if (product.productKind !== 'custom') throw AppError.badRequest('Only custom products use manual fulfillment.');

  const message = (input.message ?? '').trim();
  const deliveryUrl = (input.deliveryUrl ?? '').trim();
  const assets = input.assets ?? [];
  if (!message && !deliveryUrl && assets.length === 0) {
    throw AppError.badRequest('Add a message, delivery link, or at least one file.');
  }

  order.set('fulfillmentMessage', message);
  order.set('fulfillmentDeliveryUrl', deliveryUrl);
  order.set('fulfillmentAssets', assets);
  order.fulfilmentStatus = 'fulfilled';
  order.fulfilledAt = new Date();
  await order.save();

  const entitlement = await EntitlementModel.findOne({ orderId: order.id, buyerEmail: order.buyerEmail });
  const fulfilmentUrl = entitlement
    ? `${env.APP_URL}/access/${entitlement.accessToken}`
    : `${env.APP_URL}/dashboard/orders`;

  const branding = await resolveCreatorBranding(creatorId).catch(() => ({
    displayName: 'CreatorStore',
    username: '',
    replyTo: undefined as string | undefined,
  }));
  const portalUrl = branding.username
    ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(order.buyerEmail)}`
    : undefined;

  await enqueueEmail(
    order.buyerEmail,
    'custom_order_delivered',
    {
      productTitle: product.title,
      fulfilmentUrl,
      fulfillmentMessage: message,
      deliveryUrl: deliveryUrl || undefined,
      creatorName: branding.displayName,
      portalUrl,
    },
    { fromName: branding.displayName, replyTo: branding.replyTo },
  );

  recordAudit({
    action: 'order.fulfilled',
    actorType: 'user',
    creatorId,
    targetType: 'order',
    targetId: order.id,
    metadata: { manual: true, assetCount: assets.length },
  });

  return { ok: true, fulfilmentStatus: order.fulfilmentStatus };
}

export async function incomeSummary(creatorId: string) {
  const cid = new Types.ObjectId(creatorId);
  const since = sinceDate();

  const [windowAgg, lifetimeAgg, productCount] = await Promise.all([
    OrderModel.aggregate([
      { $match: paidInWindowMatch(cid, since) },
      {
        $group: {
          _id: null,
          revenueCents: { $sum: '$amountCents' },
          platformFeesCents: { $sum: { $ifNull: ['$applicationFeeCents', 0] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    OrderModel.aggregate([
      { $match: { creatorId: cid, status: 'paid' } },
      {
        $group: {
          _id: null,
          revenueCents: { $sum: '$amountCents' },
          platformFeesCents: { $sum: { $ifNull: ['$applicationFeeCents', 0] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    ProductModel.countDocuments({ creatorId: cid, status: 'published' }),
  ]);

  const payouts = await payoutSummary(creatorId);

  const windowRevenue = windowAgg[0]?.revenueCents ?? 0;
  const windowFees = windowAgg[0]?.platformFeesCents ?? 0;
  const lifetimeRevenue = lifetimeAgg[0]?.revenueCents ?? 0;
  const lifetimeFees = lifetimeAgg[0]?.platformFeesCents ?? 0;

  return {
    revenueCents: windowRevenue,
    platformFeesCents: windowFees,
    netRevenueCents: Math.max(0, windowRevenue - windowFees),
    orders: windowAgg[0]?.orders ?? 0,
    lifetimeRevenueCents: lifetimeRevenue,
    lifetimePlatformFeesCents: lifetimeFees,
    lifetimeNetRevenueCents: Math.max(0, lifetimeRevenue - lifetimeFees),
    lifetimeOrders: lifetimeAgg[0]?.orders ?? 0,
    windowDays: INCOME_WINDOW_DAYS,
    publishedProducts: productCount,
    payouts,
  };
}

/** Stripe Connect balance for the creator's connected account (USD). */
export async function payoutSummary(creatorId: string) {
  const accountId = await getConnectedAccountId(creatorId);
  if (!accountId || !env.stripeConfigured) {
    return {
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      availableCents: 0,
      pendingCents: 0,
      currency: 'usd',
    };
  }

  const connect = await refreshStatus(creatorId).catch(() => null);

  try {
    const stripe = requireStripe();
    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const pick = (arr: { currency: string; amount: number }[], currency = 'usd') =>
      arr.find((b) => b.currency === currency)?.amount ?? 0;
    return {
      connected: true,
      chargesEnabled: connect?.chargesEnabled ?? false,
      payoutsEnabled: connect?.payoutsEnabled ?? false,
      availableCents: pick(balance.available),
      pendingCents: pick(balance.pending),
      currency: 'usd',
    };
  } catch {
    return {
      connected: true,
      chargesEnabled: connect?.chargesEnabled ?? false,
      payoutsEnabled: connect?.payoutsEnabled ?? false,
      availableCents: 0,
      pendingCents: 0,
      currency: 'usd',
    };
  }
}

/** One-time Stripe Express dashboard link so the creator can cash out to their bank. */
export async function createPayoutDashboardLink(creatorId: string): Promise<{ url: string }> {
  const accountId = await getConnectedAccountId(creatorId);
  if (!accountId) throw AppError.badRequest('Connect Stripe in Settings → Payments before cashing out.');
  const stripe = requireStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return { url: link.url };
}

/** Daily revenue buckets for the income chart (last N days, inclusive of today). */
export async function revenueTimeseries(creatorId: string, days = INCOME_WINDOW_DAYS) {
  const cid = new Types.ObjectId(creatorId);
  const since = sinceDate(days);

  const rows = await OrderModel.aggregate([
    { $match: paidInWindowMatch(cid, since) },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$paidAt', '$createdAt'] } } },
        revenueCents: { $sum: '$amountCents' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDay = new Map(rows.map((r) => [r._id as string, r.revenueCents as number]));
  const buckets: { date: string; label: string; revenueCents: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      date: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      revenueCents: byDay.get(key) ?? 0,
    });
  }

  return buckets;
}
