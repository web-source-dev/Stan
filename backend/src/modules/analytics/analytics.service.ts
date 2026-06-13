import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { AnalyticsEventModel, type EventType } from '../../models/AnalyticsEvent';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { OrderModel } from '../../models/Order';

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

/** Conversion funnel for the last `days` days. */
export async function summary(creatorId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const cid = new Types.ObjectId(creatorId);

  const counts = await AnalyticsEventModel.aggregate([
    { $match: { creatorId: cid, createdAt: { $gte: since } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const byType: Record<string, number> = {};
  for (const c of counts) byType[c._id] = c.count;

  const [orders, revenueAgg] = await Promise.all([
    OrderModel.countDocuments({ creatorId: cid, status: 'paid', paidAt: { $gte: since } }),
    OrderModel.aggregate([
      { $match: { creatorId: cid, status: 'paid', paidAt: { $gte: since } } },
      { $group: { _id: null, revenueCents: { $sum: '$amountCents' } } },
    ]),
  ]);

  const views = byType.view ?? 0;
  const checkoutStarts = byType.checkout_start ?? 0;
  const leadSubmits = byType.lead_submit ?? 0;

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  return {
    days,
    views,
    revenueCents: revenueAgg[0]?.revenueCents ?? 0,
    productClicks: byType.product_click ?? 0,
    checkoutStarts,
    leadSubmits,
    orders,
    visitToCheckoutRate: pct(checkoutStarts, views),
    checkoutToOrderRate: pct(orders, checkoutStarts),
    leadConversionRate: pct(leadSubmits, views),
  };
}
