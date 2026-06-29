import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { AnalyticsEventModel, type EventType } from '../../models/AnalyticsEvent';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { OrderModel } from '../../models/Order';
import { ProductModel } from '../../models/Product';
import { CourseModel } from '../../models/Course';
import { BookingTypeModel } from '../../models/Booking';

interface TrackInput {
  username: string;
  type: EventType;
  slug?: string;
  anonId?: string;
  path?: string;
}

/** Record a storefront analytics event, resolving the tenant from username. */
export async function track(input: TrackInput): Promise<void> {
  const profile = await CreatorProfileModel.findOne({ username: input.username }).select('userId published');
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  await AnalyticsEventModel.create({
    creatorId: profile.userId,
    type: input.type,
    anonId: input.anonId ?? '',
    path: input.path ?? '',
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

/** Paid orders in range — uses paidAt, falling back to createdAt. */
function paidOrderMatch(creatorId: Types.ObjectId, fromStart: Date, toEnd: Date, opts: SummaryOptions) {
  const match: Record<string, unknown> = {
    creatorId,
    status: 'paid',
    $expr: {
      $and: [
        { $gte: [{ $ifNull: ['$paidAt', '$createdAt'] }, fromStart] },
        { $lte: [{ $ifNull: ['$paidAt', '$createdAt'] }, toEnd] },
      ],
    },
  };
  if (opts.productId && /^[a-f0-9]{24}$/.test(opts.productId)) {
    match.productId = new Types.ObjectId(opts.productId);
  }
  if (opts.source) match.source = opts.source;
  return match;
}

export interface SummaryOptions {
  days?: number;
  /** Custom range start/end (override `days`). */
  from?: Date;
  to?: Date;
  /** Filter commerce metrics (revenue/orders/timeseries) to one product. */
  productId?: string;
  /** Filter commerce metrics to one acquisition source (Order.source). */
  source?: string;
}

/**
 * Conversion funnel + commerce analytics for a date range, with optional
 * product / source filters. Traffic metrics (views, clicks, leads) are
 * store-wide for the range; revenue/orders/timeseries honor the filters.
 */
export async function summary(creatorId: string, opts: SummaryOptions = {}) {
  const cid = new Types.ObjectId(creatorId);

  // Normalize the window to whole UTC days so buckets line up with $dateToString.
  const toRef = opts.to ?? new Date();
  const fromRef = opts.from ?? new Date(toRef.getTime() - ((opts.days ?? 30) - 1) * DAY_MS);
  const fromStart = new Date(Date.UTC(fromRef.getUTCFullYear(), fromRef.getUTCMonth(), fromRef.getUTCDate(), 0, 0, 0, 0));
  const toEnd = new Date(Date.UTC(toRef.getUTCFullYear(), toRef.getUTCMonth(), toRef.getUTCDate(), 23, 59, 59, 999));
  const days = Math.floor((toEnd.getTime() - fromStart.getTime()) / DAY_MS) + 1;

  const eventRange = { creatorId: cid, createdAt: { $gte: fromStart, $lte: toEnd } };
  const orderMatch = paidOrderMatch(cid, fromStart, toEnd, opts);

  const [counts, uniqAgg, ordersAgg, viewsByDay, ordersByDay, topProductsAgg, topSourcesAgg, products, sources] =
    await Promise.all([
      AnalyticsEventModel.aggregate([{ $match: eventRange }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
      AnalyticsEventModel.aggregate([
        { $match: { ...eventRange, anonId: { $ne: '' } } },
        { $group: { _id: '$anonId' } },
        { $count: 'n' },
      ]),
      OrderModel.aggregate([{ $match: orderMatch }, { $group: { _id: null, orders: { $sum: 1 }, revenueCents: { $sum: '$amountCents' } } }]),
      AnalyticsEventModel.aggregate([
        { $match: { ...eventRange, type: 'view' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, c: { $sum: 1 } } },
      ]),
      OrderModel.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$paidAt', '$createdAt'] } } },
            orders: { $sum: 1 },
            revenueCents: { $sum: '$amountCents' },
          },
        },
      ]),
      OrderModel.aggregate([
        { $match: orderMatch },
        { $group: { _id: '$productId', orders: { $sum: 1 }, revenueCents: { $sum: '$amountCents' } } },
        { $sort: { revenueCents: -1 } },
        { $limit: 5 },
      ]),
      OrderModel.aggregate([
        { $match: orderMatch },
        { $group: { _id: '$source', orders: { $sum: 1 }, revenueCents: { $sum: '$amountCents' } } },
        { $sort: { revenueCents: -1 } },
        { $limit: 6 },
      ]),
      ProductModel.find({ creatorId: cid }).select('title').sort({ createdAt: -1 }),
      OrderModel.distinct('source', { creatorId: cid, status: 'paid' }),
    ]);

  const byType: Record<string, number> = {};
  for (const c of counts) byType[c._id] = c.count;
  const views = byType.view ?? 0;
  const productClicks = byType.product_click ?? 0;
  const checkoutStarts = byType.checkout_start ?? 0;
  const leadSubmits = byType.lead_submit ?? 0;
  const ctaClicks = byType.cta_click ?? 0;
  const orders = ordersAgg[0]?.orders ?? 0;
  const revenueCents = ordersAgg[0]?.revenueCents ?? 0;

  // Build a zero-filled daily timeseries across the whole window.
  const viewsMap = new Map<string, number>(viewsByDay.map((d) => [d._id, d.c]));
  const ordMap = new Map<string, { orders: number; revenueCents: number }>(
    ordersByDay.map((d) => [d._id, { orders: d.orders, revenueCents: d.revenueCents }]),
  );
  const timeseries: { date: string; views: number; orders: number; revenueCents: number }[] = [];
  for (let t = fromStart.getTime(); t <= toEnd.getTime(); t += DAY_MS) {
    const key = isoDay(t);
    const o = ordMap.get(key);
    timeseries.push({ date: key, views: viewsMap.get(key) ?? 0, orders: o?.orders ?? 0, revenueCents: o?.revenueCents ?? 0 });
  }

  // Resolve titles for top products (product, course, or booking line items).
  const topIds = topProductsAgg.map((t) => t._id).filter(Boolean);
  const [topProds, topCourses, topBookings] = topIds.length
    ? await Promise.all([
        ProductModel.find({ _id: { $in: topIds } }).select('title'),
        CourseModel.find({ _id: { $in: topIds } }).select('title'),
        BookingTypeModel.find({ _id: { $in: topIds } }).select('title'),
      ])
    : [[], [], []];
  const titleMap = new Map<string, string>([
    ...products.map((p) => [p.id, p.title] as [string, string]),
    ...topProds.map((p) => [p.id, p.title] as [string, string]),
    ...topCourses.map((c) => [c.id, c.title] as [string, string]),
    ...topBookings.map((b) => [b.id, b.title] as [string, string]),
  ]);
  const topProducts = topProductsAgg.map((t) => ({
    id: String(t._id),
    title: titleMap.get(String(t._id)) ?? 'Product',
    orders: t.orders,
    revenueCents: t.revenueCents,
  }));
  const topSources = topSourcesAgg.map((t) => ({ source: t._id || 'direct', orders: t.orders, revenueCents: t.revenueCents }));

  return {
    range: { days, from: fromStart.toISOString(), to: toEnd.toISOString() },
    filtered: { productId: opts.productId ?? '', source: opts.source ?? '' },
    totals: {
      views,
      uniqueVisitors: uniqAgg[0]?.n ?? 0,
      productClicks,
      ctaClicks,
      checkoutStarts,
      leadSubmits,
      orders,
      revenueCents,
      aovCents: orders ? Math.round(revenueCents / orders) : 0,
    },
    rates: {
      visitToCheckout: pct(checkoutStarts, views),
      checkoutToOrder: pct(orders, checkoutStarts),
      leadConversion: pct(leadSubmits, views),
      viewToOrder: pct(orders, views),
    },
    timeseries,
    topProducts,
    topSources,
    filters: {
      products: products.map((p) => ({ id: p.id, title: p.title })),
      sources: (sources as string[]).filter(Boolean),
    },
    // Back-compat flat fields (older callers).
    days,
    views,
    revenueCents,
    productClicks,
    checkoutStarts,
    leadSubmits,
    orders,
  };
}
