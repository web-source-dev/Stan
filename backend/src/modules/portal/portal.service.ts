import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { hashToken } from '../../lib/tokens';
import { signPortalToken } from '../../lib/jwt';
import { enqueueEmail } from '../../lib/jobs';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { CustomerLoginCodeModel } from '../../models/CustomerLoginCode';
import { EntitlementModel } from '../../models/Entitlement';
import { EnrollmentModel } from '../../models/Enrollment';
import { BookingModel, BookingTypeModel } from '../../models/Booking';
import { OrderModel } from '../../models/Order';
import { ProductModel } from '../../models/Product';
import { CourseModel, CourseLessonModel } from '../../models/Course';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

async function resolveCreator(username: string) {
  const profile = await CreatorProfileModel.findOne({ username: username.toLowerCase() });
  if (!profile || !profile.published) throw AppError.notFound('Store not found');
  return profile;
}

/**
 * Issue a passwordless login code for a buyer to access a creator's portal.
 * Always behaves the same regardless of whether the email has purchases, so the
 * endpoint can't be used to probe who is a customer. In dev (email unconfigured)
 * the code is returned so the flow is testable without an inbox.
 */
export async function requestLoginCode(username: string, emailRaw: string) {
  const profile = await resolveCreator(username);
  const creatorId = String(profile.userId);
  const email = emailRaw.toLowerCase().trim();

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

  // One active code per (creator, email).
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

  // Dev convenience: surface the code in non-production so the portal is
  // testable with throwaway buyer emails (mirrors the app's dev email bypass).
  // Production never leaks it — the buyer must use the emailed code.
  return { sent: true, ...(env.isProd ? {} : { devCode: code }) };
}

/** Verify a login code and mint a portal session token scoped to this creator. */
export async function verifyLoginCode(username: string, emailRaw: string, code: string) {
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
  return {
    token,
    creator: {
      username: profile.username,
      displayName: profile.displayName || profile.username,
      avatarUrl: profile.avatarUrl || '',
    },
  };
}

/** Everything a signed-in customer has from this creator, in one payload. */
export async function getPortalDashboard(creatorId: string, email: string) {
  const buyerEmail = email.toLowerCase();

  const [entitlements, enrollments, bookings, orders, profile] = await Promise.all([
    EntitlementModel.find({ creatorId, buyerEmail }).sort({ createdAt: -1 }),
    EnrollmentModel.find({ creatorId, buyerEmail }).sort({ createdAt: -1 }),
    BookingModel.find({ creatorId, buyerEmail, status: { $in: ['confirmed', 'pending_payment'] } }).sort({ startAt: -1 }),
    OrderModel.find({ creatorId, buyerEmail, status: 'paid' }).sort({ paidAt: -1, createdAt: -1 }),
    CreatorProfileModel.findOne({ userId: creatorId }),
  ]);

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
  const bookingList = bookings.map((b) => ({
    id: b.id,
    title: btTitle.get(String(b.bookingTypeId)) ?? 'Session',
    startAt: b.startAt,
    timezone: b.timezone,
    whenText: DateTime.fromJSDate(b.startAt).setZone(b.timezone || 'UTC').toFormat("ccc, LLL d 'at' h:mm a"),
    status: b.status,
    meetingUrl: b.meetingUrl || '',
    manageToken: b.manageToken,
    upcoming: b.startAt.getTime() > Date.now(),
  }));

  const orderList = orders.map((o) => ({
    id: o.id,
    amountCents: o.amountCents,
    currency: o.currency,
    createdAt: o.paidAt ?? o.get('createdAt'),
  }));

  const spentCents = orders.reduce((sum, o) => sum + o.amountCents, 0);

  return {
    email: buyerEmail,
    creator: profile
      ? { username: profile.username, displayName: profile.displayName || profile.username, avatarUrl: profile.avatarUrl || '' }
      : null,
    summary: {
      purchases: orders.length,
      spentCents,
      products: products.filter(Boolean).length,
      courses: courses.filter(Boolean).length,
      bookings: bookingList.length,
    },
    products: products.filter(Boolean),
    courses: courses.filter(Boolean),
    bookings: bookingList,
    orders: orderList,
  };
}
