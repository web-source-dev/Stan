import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { bookingDisplayStatus } from '../bookings/bookingDisplay';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { hashToken } from '../../lib/tokens';
import { signPortalToken, signGlobalPortalToken } from '../../lib/jwt';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { CustomerLoginCodeModel } from '../../models/CustomerLoginCode';
import { EntitlementModel } from '../../models/Entitlement';
import { EnrollmentModel } from '../../models/Enrollment';
import { BookingModel, BookingTypeModel } from '../../models/Booking';
import { OrderModel } from '../../models/Order';
import { ProductModel } from '../../models/Product';
import { CourseModel, CourseLessonModel } from '../../models/Course';
import { LeadModel } from '../../models/Lead';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const ORDERS_PAGE_SIZE = 50;

interface AuditCtx { ip?: string; userAgent?: string }

async function resolveCreator(username: string) {
  const profile = await CreatorProfileModel.findOne({ username: username.toLowerCase() });
  if (!profile || !profile.published) throw AppError.notFound('Store not found');
  return profile;
}

/**
 * Issue a passwordless login code for a buyer to access a creator's portal.
 * Always behaves the same regardless of whether the email has purchases, so the
 * endpoint can't be used to probe who is a customer.
 */
export async function requestLoginCode(username: string, emailRaw: string) {
  const profile = await resolveCreator(username);
  const creatorId = String(profile.userId);
  const email = emailRaw.toLowerCase().trim();

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

  await CustomerLoginCodeModel.deleteMany({ creatorId, email });
  await CustomerLoginCodeModel.create({
    creatorId,
    email,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await enqueueEmail(email, 'customer_login_code', {
    code,
    creatorName: profile.displayName || profile.username,
  }).catch(() => {});

  return { sent: true, ...(env.isProd ? {} : { devCode: code }) };
}

/** Verify a login code and mint a portal session token scoped to this creator. */
export async function verifyLoginCode(
  username: string,
  emailRaw: string,
  code: string,
  ctx: AuditCtx = {},
) {
  const profile = await resolveCreator(username);
  const creatorId = String(profile.userId);
  const email = emailRaw.toLowerCase().trim();

  const record = await CustomerLoginCodeModel.findOne({ creatorId, email });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('That code is invalid or has expired. Request a new one.');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await CustomerLoginCodeModel.deleteOne({ _id: record._id });
    throw AppError.badRequest('Too many attempts. Request a new code.');
  }
  if (record.codeHash !== hashToken(code.trim())) {
    record.attempts += 1;
    await record.save();
    throw AppError.badRequest('Incorrect code. Please try again.');
  }

  await CustomerLoginCodeModel.deleteMany({ creatorId, email });
  const token = signPortalToken({ sub: email, creatorId });

  recordAudit({
    action: 'portal.login',
    actorType: 'anonymous',
    creatorId,
    targetType: 'buyer',
    targetId: email,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { portalType: 'per-store', username },
  });

  return {
    token,
    creator: {
      username: profile.username,
      displayName: profile.displayName || profile.username,
      avatarUrl: profile.avatarUrl || '',
    },
  };
}

const MONTH_KEY = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Last-12-months paid-spend timeline for the buyer's mini spend chart. */
function buildMonthlySpend(paid: { amountCents: number; when: Date }[]) {
  const now = new Date();
  const buckets = new Map<string, { spentCents: number; orders: number }>();
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = MONTH_KEY(d);
    keys.push(k);
    buckets.set(k, { spentCents: 0, orders: 0 });
  }
  for (const o of paid) {
    const b = buckets.get(MONTH_KEY(o.when));
    if (b) { b.spentCents += o.amountCents; b.orders += 1; }
  }
  return keys.map((k) => ({ month: k, ...buckets.get(k)! }));
}

/** Everything a signed-in customer has from this creator, in one payload. */
export async function getPortalDashboard(creatorId: string, email: string) {
  const buyerEmail = email.toLowerCase();

  const [entitlements, enrollments, bookings, allOrders, profile] = await Promise.all([
    EntitlementModel.find({ creatorId, buyerEmail }).sort({ createdAt: -1 }),
    EnrollmentModel.find({ creatorId, buyerEmail }).sort({ createdAt: -1 }),
    BookingModel.find({ creatorId, buyerEmail, status: { $in: ['confirmed', 'pending_payment'] } }).sort({ startAt: -1 }),
    OrderModel.find({ creatorId, buyerEmail, status: { $in: ['paid', 'refunded'] } }).sort({ paidAt: -1, createdAt: -1 }),
    CreatorProfileModel.findOne({ userId: creatorId }),
  ]);

  const ordersTotal = allOrders.length;
  const orders = allOrders.slice(0, ORDERS_PAGE_SIZE);

  // Products
  const products = await Promise.all(
    entitlements
      .filter((e) => !e.revokedAt)
      .map(async (e) => {
        const product = await ProductModel.findById(e.productId);
        if (!product) return null;
        return {
          id: e.id,
          title: product.title,
          coverImageUrl: product.coverImageUrl || '',
          fileCount: product.assets.length,
          downloadCount: e.downloadCount,
          accessToken: e.accessToken,
        };
      }),
  );

  // Courses (with progress)
  const courses = await Promise.all(
    enrollments
      .filter((e) => !e.revokedAt)
      .map(async (e) => {
        const course = await CourseModel.findById(e.courseId);
        if (!course) return null;
        const total = await CourseLessonModel.countDocuments({ courseId: course.id });
        return {
          id: e.id,
          title: course.title,
          coverImageUrl: course.coverImageUrl || '',
          progress: { completed: e.completedLessonIds.length, total },
          accessToken: e.accessToken,
        };
      }),
  );

  // Bookings
  const bookingTypeIds = [...new Set(bookings.map((b) => String(b.bookingTypeId)))];
  const bts = await BookingTypeModel.find({ _id: { $in: bookingTypeIds } });
  const btTitle = new Map(bts.map((bt) => [bt.id, bt.title]));
  const btMeetingUrl = new Map(bts.map((bt) => [bt.id, bt.meetingUrl ?? '']));
  const bookingList = bookings.map((b) => ({
    id: b.id,
    title: btTitle.get(String(b.bookingTypeId)) ?? 'Session',
    startAt: b.startAt,
    endAt: b.endAt,
    timezone: b.timezone,
    whenText: DateTime.fromJSDate(b.startAt).setZone(b.timezone || 'UTC').toFormat("ccc, LLL d 'at' h:mm a"),
    status: b.status,
    displayStatus: bookingDisplayStatus(b),
    meetingUrl: b.meetingUrl || btMeetingUrl.get(String(b.bookingTypeId)) || '',
    manageToken: b.manageToken,
    upcoming: b.startAt.getTime() > Date.now(),
  }));

  const orderProductIds = [...new Set(orders.map((o) => String(o.productId)))];
  const orderProducts = await ProductModel.find({ _id: { $in: orderProductIds } });
  const orderProductTitle = new Map(orderProducts.map((p) => [p.id, p.title]));

  const orderList = orders.map((o) => ({
    id: o.id,
    title: orderProductTitle.get(String(o.productId)) ?? 'Purchase',
    amountCents: o.amountCents,
    currency: o.currency,
    status: o.status,
    provider: o.paymentProvider,
    createdAt: (o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date()) as Date,
    refundedAt: o.refundedAt ?? null,
  }));

  const paid = allOrders.filter((o) => o.status === 'paid');
  const refunded = allOrders.filter((o) => o.status === 'refunded');
  const spentCents = paid.reduce((sum, o) => sum + o.amountCents, 0);
  const refundedCents = refunded.reduce((sum, o) => sum + o.amountCents, 0);
  const paidWhen = paid
    .map((o) => (o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    email: buyerEmail,
    creator: profile
      ? { username: profile.username, displayName: profile.displayName || profile.username, avatarUrl: profile.avatarUrl || '' }
      : null,
    summary: {
      purchases: paid.length,
      spentCents,
      refundedCents,
      netCents: spentCents - refundedCents,
      aovCents: paid.length ? Math.round(spentCents / paid.length) : 0,
      currency: paid[0]?.currency ?? 'usd',
      firstPurchaseAt: paidWhen[0] ?? null,
      lastPurchaseAt: paidWhen[paidWhen.length - 1] ?? null,
      products: products.filter(Boolean).length,
      courses: courses.filter(Boolean).length,
      bookings: bookingList.length,
    },
    products: products.filter(Boolean),
    courses: courses.filter(Boolean),
    bookings: bookingList,
    orders: orderList,
    ordersTotal,
    hasMoreOrders: ordersTotal > ORDERS_PAGE_SIZE,
    monthly: buildMonthlySpend(paid.map((o) => ({ amountCents: o.amountCents, when: o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date() }))),
  };
}

/** Paginated order history for the "load more" endpoint. */
export async function getPortalOrders(
  creatorId: string,
  email: string,
  skip: number,
  limit: number,
) {
  const buyerEmail = email.toLowerCase();
  const orders = await OrderModel.find({ creatorId, buyerEmail, status: { $in: ['paid', 'refunded'] } })
    .sort({ paidAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const productIds = [...new Set(orders.map((o) => String(o.productId)))];
  const products = await ProductModel.find({ _id: { $in: productIds } });
  const titleMap = new Map(products.map((p) => [p.id, p.title]));

  return orders.map((o) => ({
    id: o.id,
    title: titleMap.get(String(o.productId)) ?? 'Purchase',
    amountCents: o.amountCents,
    currency: o.currency,
    status: o.status,
    provider: o.paymentProvider,
    createdAt: (o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date()) as Date,
    refundedAt: o.refundedAt ?? null,
  }));
}

/* ================================================================== */
/* Notification preferences (per creator subscription)               */
/* ================================================================== */

/** Read the buyer's subscription status for a creator's list. */
export async function getPortalPrefs(creatorId: string, email: string) {
  const lead = await LeadModel.findOne({ creatorId, email: email.toLowerCase() });
  // If no lead record yet (buyer hasn't signed up for mailing list), default to subscribed.
  return { subscribed: lead ? !lead.unsubscribedAt : true };
}

/** Toggle the buyer's subscription for a creator's broadcast list. */
export async function setPortalPrefs(
  creatorId: string,
  email: string,
  prefs: { subscribed: boolean },
) {
  const buyerEmail = email.toLowerCase();
  const lead = await LeadModel.findOne({ creatorId, email: buyerEmail });
  if (!lead) return { subscribed: prefs.subscribed }; // No lead record = nothing to toggle

  if (prefs.subscribed) {
    await LeadModel.updateOne({ _id: lead._id }, { $unset: { unsubscribedAt: '' } });
  } else {
    await LeadModel.updateOne({ _id: lead._id }, { $set: { unsubscribedAt: new Date() } });
  }
  return { subscribed: prefs.subscribed };
}

/* ================================================================== */
/* Global portal — one buyer, every store                             */
/* ================================================================== */

const GLOBAL_CODE_SCOPE = new Types.ObjectId('000000000000000000000000');

/** Issue a passwordless login code for the cross-store buyer portal. */
export async function requestGlobalLoginCode(emailRaw: string) {
  const email = emailRaw.toLowerCase().trim();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

  await CustomerLoginCodeModel.deleteMany({ creatorId: GLOBAL_CODE_SCOPE, email });
  await CustomerLoginCodeModel.create({
    creatorId: GLOBAL_CODE_SCOPE,
    email,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await enqueueEmail(email, 'customer_login_code', { code, creatorName: 'CreatorStore' }).catch(() => {});

  return { sent: true, ...(env.isProd ? {} : { devCode: code }) };
}

/** Verify a cross-store login code and mint an email-scoped global session. */
export async function verifyGlobalLoginCode(
  emailRaw: string,
  code: string,
  ctx: AuditCtx = {},
) {
  const email = emailRaw.toLowerCase().trim();

  const record = await CustomerLoginCodeModel.findOne({ creatorId: GLOBAL_CODE_SCOPE, email });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('That code is invalid or has expired. Request a new one.');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await CustomerLoginCodeModel.deleteOne({ _id: record._id });
    throw AppError.badRequest('Too many attempts. Request a new code.');
  }
  if (record.codeHash !== hashToken(code.trim())) {
    record.attempts += 1;
    await record.save();
    throw AppError.badRequest('Incorrect code. Please try again.');
  }

  await CustomerLoginCodeModel.deleteMany({ creatorId: GLOBAL_CODE_SCOPE, email });

  recordAudit({
    action: 'portal.login',
    actorType: 'anonymous',
    targetType: 'buyer',
    targetId: email,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { portalType: 'global' },
  });

  return { token: signGlobalPortalToken({ sub: email }) };
}

/**
 * Everything a buyer owns across EVERY creator's store, grouped by store.
 * Returns first ORDERS_PAGE_SIZE orders in the flat globalOrders list; the
 * per-store orders arrays are limited to 5 (for the overview view only).
 */
export async function getGlobalDashboard(email: string) {
  const buyerEmail = email.toLowerCase();

  const [entitlements, enrollments, bookings, allOrders] = await Promise.all([
    EntitlementModel.find({ buyerEmail }).sort({ createdAt: -1 }),
    EnrollmentModel.find({ buyerEmail }).sort({ createdAt: -1 }),
    BookingModel.find({ buyerEmail, status: { $in: ['confirmed', 'pending_payment'] } }).sort({ startAt: -1 }),
    OrderModel.find({ buyerEmail, status: { $in: ['paid', 'refunded'] } }).sort({ paidAt: -1, createdAt: -1 }),
  ]);

  const productIds = [...new Set([...allOrders.map((o) => String(o.productId)), ...entitlements.map((e) => String(e.productId))])];
  const courseIds = [...new Set(enrollments.map((e) => String(e.courseId)))];
  const btIds = [...new Set(bookings.map((b) => String(b.bookingTypeId)))];
  const [productDocs, courseDocs, btDocs] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }),
    CourseModel.find({ _id: { $in: courseIds } }),
    BookingTypeModel.find({ _id: { $in: btIds } }),
  ]);
  const productMap = new Map(productDocs.map((p) => [p.id, p]));
  const courseMap = new Map(courseDocs.map((c) => [c.id, c]));
  const btTitle = new Map(btDocs.map((bt) => [bt.id, bt.title]));
  const lessonCounts = new Map<string, number>();
  await Promise.all(courseDocs.map(async (c) => lessonCounts.set(c.id, await CourseLessonModel.countDocuments({ courseId: c.id }))));

  const creatorIds = [
    ...new Set([
      ...allOrders.map((o) => String(o.creatorId)),
      ...entitlements.map((e) => String(e.creatorId)),
      ...enrollments.map((e) => String(e.creatorId)),
      ...bookings.map((b) => String(b.creatorId)),
    ]),
  ];
  const profiles = await CreatorProfileModel.find({ userId: { $in: creatorIds } });
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  // Pre-build the set so the filter can check order presence without a circular reference.
  const usernamesWithOrders = new Set<string>(
    allOrders.flatMap((o) => { const u = profileMap.get(String(o.creatorId))?.username; return u ? [u] : []; }),
  );

  const stores = creatorIds
    .map((creatorId) => {
      const profile = profileMap.get(creatorId);
      const ents = entitlements.filter((e) => String(e.creatorId) === creatorId && !e.revokedAt);
      const enrs = enrollments.filter((e) => String(e.creatorId) === creatorId && !e.revokedAt);
      const bks = bookings.filter((b) => String(b.creatorId) === creatorId);
      const ords = allOrders.filter((o) => String(o.creatorId) === creatorId);

      const products = ents
        .map((e) => {
          const p = productMap.get(String(e.productId));
          if (!p) return null;
          return { id: e.id, title: p.title, coverImageUrl: p.coverImageUrl || '', fileCount: p.assets.length, downloadCount: e.downloadCount, accessToken: e.accessToken };
        })
        .filter(Boolean);

      const courses = enrs
        .map((e) => {
          const c = courseMap.get(String(e.courseId));
          if (!c) return null;
          return { id: e.id, title: c.title, coverImageUrl: c.coverImageUrl || '', progress: { completed: e.completedLessonIds.length, total: lessonCounts.get(String(e.courseId)) ?? 0 }, accessToken: e.accessToken };
        })
        .filter(Boolean);

      const bookingList = bks.map((b) => ({
        id: b.id,
        title: btTitle.get(String(b.bookingTypeId)) ?? 'Session',
        whenText: DateTime.fromJSDate(b.startAt).setZone(b.timezone || 'UTC').toFormat("ccc, LLL d 'at' h:mm a"),
        status: b.status,
        meetingUrl: b.meetingUrl || '',
        manageToken: b.manageToken,
        upcoming: b.startAt.getTime() > Date.now(),
      }));

      const paid = ords.filter((o) => o.status === 'paid');
      const spentCents = paid.reduce((s, o) => s + o.amountCents, 0);

      return {
        creator: {
          username: profile?.username ?? '',
          displayName: profile?.displayName || profile?.username || 'Store',
          avatarUrl: profile?.avatarUrl || '',
          published: Boolean(profile?.published),
        },
        summary: {
          purchases: paid.length,
          spentCents,
          currency: paid[0]?.currency ?? 'usd',
          products: products.length,
          courses: courses.length,
          bookings: bookingList.length,
        },
        products,
        courses,
        bookings: bookingList,
      };
    })
    .filter((s) => s.creator.username) // drop unresolvable profiles
    .filter((s) => s.products.length || s.courses.length || s.bookings.length || usernamesWithOrders.has(s.creator.username))
    .sort((a, b) => b.summary.spentCents - a.summary.spentCents);

  // Flat paginated order list across all stores, sorted by date (most recent first).
  const globalOrdersTotal = allOrders.length;
  const globalOrders = allOrders.slice(0, ORDERS_PAGE_SIZE).map((o) => {
    const profile = profileMap.get(String(o.creatorId));
    return {
      id: o.id,
      title: productMap.get(String(o.productId))?.title ?? 'Purchase',
      amountCents: o.amountCents,
      currency: o.currency,
      status: o.status,
      provider: o.paymentProvider,
      createdAt: (o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date()) as Date,
      refundedAt: o.refundedAt ?? null,
      store: {
        username: profile?.username ?? '',
        displayName: profile?.displayName || profile?.username || 'Store',
      },
    };
  });

  const paidAll = allOrders.filter((o) => o.status === 'paid');
  const refundedAll = allOrders.filter((o) => o.status === 'refunded');
  const spentCents = paidAll.reduce((s, o) => s + o.amountCents, 0);
  const refundedCents = refundedAll.reduce((s, o) => s + o.amountCents, 0);
  const paidWhen = paidAll.map((o) => (o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date())).sort((a, b) => a.getTime() - b.getTime());

  return {
    email: buyerEmail,
    summary: {
      stores: stores.length,
      purchases: paidAll.length,
      spentCents,
      refundedCents,
      netCents: spentCents - refundedCents,
      aovCents: paidAll.length ? Math.round(spentCents / paidAll.length) : 0,
      currency: paidAll[0]?.currency ?? 'usd',
      firstPurchaseAt: paidWhen[0] ?? null,
      lastPurchaseAt: paidWhen[paidWhen.length - 1] ?? null,
      products: stores.reduce((n, s) => n + s.summary.products, 0),
      courses: stores.reduce((n, s) => n + s.summary.courses, 0),
      bookings: stores.reduce((n, s) => n + s.summary.bookings, 0),
    },
    monthly: buildMonthlySpend(paidAll.map((o) => ({ amountCents: o.amountCents, when: o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date() }))),
    stores,
    globalOrders,
    globalOrdersTotal,
    hasMoreGlobalOrders: globalOrdersTotal > ORDERS_PAGE_SIZE,
  };
}

/** Paginated flat order list across all stores for the global portal load-more. */
export async function getGlobalOrders(email: string, skip: number, limit: number) {
  const buyerEmail = email.toLowerCase();
  const orders = await OrderModel.find({ buyerEmail, status: { $in: ['paid', 'refunded'] } })
    .sort({ paidAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const productIds = [...new Set(orders.map((o) => String(o.productId)))];
  const creatorIds = [...new Set(orders.map((o) => String(o.creatorId)))];
  const [products, profiles] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }),
    CreatorProfileModel.find({ userId: { $in: creatorIds } }),
  ]);
  const titleMap = new Map(products.map((p) => [p.id, p.title]));
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  return orders.map((o) => {
    const profile = profileMap.get(String(o.creatorId));
    return {
      id: o.id,
      title: titleMap.get(String(o.productId)) ?? 'Purchase',
      amountCents: o.amountCents,
      currency: o.currency,
      status: o.status,
      provider: o.paymentProvider,
      createdAt: (o.paidAt ?? (o.get('createdAt') as Date | null) ?? new Date()) as Date,
      refundedAt: o.refundedAt ?? null,
      store: {
        username: profile?.username ?? '',
        displayName: profile?.displayName || profile?.username || 'Store',
      },
    };
  });
}
