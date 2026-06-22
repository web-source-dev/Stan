import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { OrderModel } from '../../models/Order';
import { ProductModel } from '../../models/Product';
import { CourseModel } from '../../models/Course';
import { BookingTypeModel } from '../../models/Booking';
import { Types } from 'mongoose';

// Authenticated creator order views (mounted at /api/orders).
export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await OrderModel.find({ creatorId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(500);

    // An order's productId may reference a Product, Course, or BookingType
    // (course/booking purchases reuse the order line). Resolve the item name
    // across all three so every order row is labelled.
    const ids = orders.map((o) => o.get('productId')).filter(Boolean);
    const [products, courses, bookings] = await Promise.all([
      ProductModel.find({ _id: { $in: ids } }, 'title slug').lean(),
      CourseModel.find({ _id: { $in: ids } }, 'title slug').lean(),
      BookingTypeModel.find({ _id: { $in: ids } }, 'title slug').lean(),
    ]);
    const items = new Map<string, { title: string; slug: string; kind: string }>();
    for (const p of products) items.set(String(p._id), { title: p.title, slug: p.slug, kind: 'product' });
    for (const c of courses) items.set(String(c._id), { title: c.title, slug: c.slug, kind: 'course' });
    for (const b of bookings) items.set(String(b._id), { title: b.title, slug: b.slug, kind: 'booking' });

    res.json({
      orders: orders.map((o) => ({
        id: o.id,
        buyerEmail: o.buyerEmail,
        amountCents: o.amountCents,
        currency: o.currency,
        status: o.status,
        fulfilmentStatus: o.fulfilmentStatus,
        discountCode: o.get('discountCode') ?? '',
        paymentProvider: o.get('paymentProvider') || (o.amountCents === 0 ? 'free' : 'stripe'),
        product: items.get(String(o.get('productId'))) ?? null,
        createdAt: o.get('createdAt'),
      })),
    });
  }),
);

ordersRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const creatorId = new Types.ObjectId(req.user!.id);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [agg] = await OrderModel.aggregate([
      { $match: { creatorId, status: 'paid', paidAt: { $gte: since } } },
      { $group: { _id: null, revenueCents: { $sum: '$amountCents' }, orders: { $sum: 1 } } },
    ]);
    const productCount = await ProductModel.countDocuments({
      creatorId,
      status: 'published',
    });

    res.json({
      revenueCents: agg?.revenueCents ?? 0,
      orders: agg?.orders ?? 0,
      publishedProducts: productCount,
    });
  }),
);
