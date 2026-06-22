import { DateTime } from 'luxon';
import type Stripe from 'stripe';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { BookingTypeModel, BookingModel, BlockedTimeModel, type BookingTypeDoc, type BookingDoc, type BlockedTimeDoc } from '../../models/Booking';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { OrderModel } from '../../models/Order';
import { uniqueSlug } from '../../lib/slug';
import { enqueueEmail, enqueueJob } from '../../lib/jobs';
import { registerJobHandler } from '../../lib/jobRunner';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';
import { upsertCustomerLead } from '../leads/leads.service';
import { computeSlots, isSlotOpen } from './availability';

function publicType(bt: BookingTypeDoc) {
  return {
    id: bt.id,
    title: bt.title,
    slug: bt.slug,
    description: bt.description,
    shortDescription: bt.shortDescription,
    bottomTitle: bt.bottomTitle,
    ctaLabel: bt.ctaLabel,
    coverImageUrl: bt.coverImageUrl,
    coverPublicId: bt.coverPublicId,
    thumbnailStyle: bt.thumbnailStyle,
    thumbnailButtonLabel: bt.thumbnailButtonLabel,
    discountPriceCents: bt.discountPriceCents,
    discountEnabled: bt.discountEnabled,
    durationMin: bt.durationMin,
    priceCents: bt.priceCents,
    currency: bt.currency,
    timezone: bt.timezone,
    weeklyWindows: bt.weeklyWindows,
    minNoticeMin: bt.minNoticeMin,
    maxHorizonDays: bt.maxHorizonDays,
    bufferBeforeMin: bt.bufferBeforeMin,
    bufferAfterMin: bt.bufferAfterMin,
    bufferBeforeEnabled: bt.bufferBeforeEnabled,
    bufferAfterEnabled: bt.bufferAfterEnabled,
    dailyCap: bt.dailyCap,
    maxAttendees: bt.maxAttendees,
    calendarLabel: bt.calendarLabel,
    meetingProvider: bt.meetingProvider,
    meetingUrl: bt.meetingUrl,
    intakeQuestions: bt.intakeQuestions,
    confirmSubject: bt.confirmSubject,
    confirmBody: bt.confirmBody,
    status: bt.status,
  };
}

async function owned(creatorId: string, id: string): Promise<BookingTypeDoc> {
  const bt = await BookingTypeModel.findOne({ _id: id, creatorId });
  if (!bt) throw AppError.notFound('Booking type not found');
  return bt;
}

// ---- Creator management ----

export async function createBookingType(creatorId: string, input: Record<string, unknown>) {
  const title = String(input.title);
  const slug = await uniqueSlug(title, async (c) => Boolean(await BookingTypeModel.exists({ creatorId, slug: c })));
  const bt = await BookingTypeModel.create({ creatorId, slug, ...input });
  recordAudit({ action: 'booking_type.created', actorId: creatorId, actorType: 'user', creatorId, targetType: 'booking_type', targetId: bt.id });
  return publicType(bt);
}

export async function getBookingType(creatorId: string, id: string) {
  const bt = await owned(creatorId, id);
  return publicType(bt);
}

export async function listBookingTypes(creatorId: string) {
  const items = await BookingTypeModel.find({ creatorId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  return items.map(publicType);
}

export async function updateBookingType(creatorId: string, id: string, patch: Record<string, unknown>) {
  const bt = await owned(creatorId, id);
  const fields = ['title', 'description', 'shortDescription', 'bottomTitle', 'ctaLabel',
    'coverImageUrl', 'coverPublicId', 'thumbnailStyle', 'thumbnailButtonLabel', 'discountPriceCents', 'discountEnabled',
    'durationMin', 'priceCents', 'currency', 'timezone',
    'weeklyWindows', 'minNoticeMin', 'maxHorizonDays', 'bufferBeforeMin', 'bufferAfterMin',
    'bufferBeforeEnabled', 'bufferAfterEnabled', 'dailyCap', 'maxAttendees', 'calendarLabel',
    'meetingProvider', 'meetingUrl', 'intakeQuestions', 'confirmSubject', 'confirmBody'] as const;
  for (const f of fields) if (patch[f] !== undefined) (bt as unknown as Record<string, unknown>)[f] = patch[f];
  await bt.save();
  return publicType(bt);
}

export async function publishBookingType(creatorId: string, id: string) {
  const bt = await owned(creatorId, id);
  if (bt.priceCents > 0 && !(await canAcceptPayments(creatorId))) {
    throw new AppError(409, 'payments_not_ready', 'Connect a payout account before publishing a paid session');
  }
  if (bt.weeklyWindows.length === 0) throw AppError.badRequest('Add at least one availability window before publishing');
  if (bt.meetingProvider === 'manual' && !bt.meetingUrl) throw AppError.badRequest('Add a meeting link before publishing');
  bt.status = 'published';
  await bt.save();
  return publicType(bt);
}

export async function setBookingTypeStatus(creatorId: string, id: string, status: 'draft' | 'archived') {
  const bt = await owned(creatorId, id);
  bt.status = status;
  await bt.save();
  return publicType(bt);
}

export async function listBookings(creatorId: string) {
  // Include every status (cancelled too) so the dashboard can filter by it.
  const bookings = await BookingModel.find({ creatorId })
    .sort({ startAt: 1 })
    .populate('bookingTypeId', 'title durationMin')
    .limit(500);
  return bookings.map((b) => {
    const bt = b.bookingTypeId as unknown as { title?: string; durationMin?: number } | null;
    return {
      id: b.id,
      title: bt?.title ?? 'Session',
      durationMin: bt?.durationMin ?? Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000),
      buyerEmail: b.buyerEmail,
      buyerName: b.buyerName,
      startAt: b.startAt,
      endAt: b.endAt,
      timezone: b.get('timezone') || 'UTC',
      status: b.status,
      meetingUrl: b.meetingUrl,
      manageToken: b.manageToken,
      intakeAnswers: (b.intakeAnswers ?? []).map((a) => ({ question: a.question, answer: a.answer })),
      createdAt: b.get('createdAt'),
    };
  });
}

// ---- Blocked time (creator-wide calendar holds) ----

function publicBlock(b: BlockedTimeDoc) {
  return { id: b.id, startAt: b.startAt, endAt: b.endAt, allDay: b.allDay, note: b.note };
}

export async function listBlocks(creatorId: string, fromIso?: string, toIso?: string) {
  const query: Record<string, unknown> = { creatorId };
  // Blocks overlapping the [from, to] window — ignore unparseable dates so a bad
  // query param can never turn into a Mongo CastError (500).
  const from = fromIso ? new Date(fromIso) : null;
  const to = toIso ? new Date(toIso) : null;
  if (to && !Number.isNaN(to.getTime())) query.startAt = { $lt: to };
  if (from && !Number.isNaN(from.getTime())) query.endAt = { $gt: from };
  const blocks = await BlockedTimeModel.find(query).sort({ startAt: 1 }).limit(500);
  return blocks.map(publicBlock);
}

export async function createBlock(
  creatorId: string,
  input: { startIso: string; endIso: string; allDay?: boolean; note?: string },
) {
  const startAt = new Date(input.startIso);
  const endAt = new Date(input.endIso);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw AppError.badRequest('Invalid start or end time');
  }
  if (endAt <= startAt) throw AppError.badRequest('End time must be after the start time');
  const block = await BlockedTimeModel.create({
    creatorId,
    startAt,
    endAt,
    allDay: input.allDay ?? false,
    note: input.note ?? '',
  });
  recordAudit({ action: 'booking.time_blocked', actorId: creatorId, actorType: 'user', creatorId, targetType: 'blocked_time', targetId: block.id });
  return publicBlock(block);
}

export async function deleteBlock(creatorId: string, id: string): Promise<void> {
  const res = await BlockedTimeModel.deleteOne({ _id: id, creatorId });
  if (res.deletedCount === 0) throw AppError.notFound('Blocked time not found');
  recordAudit({ action: 'booking.time_unblocked', actorId: creatorId, actorType: 'user', creatorId, targetType: 'blocked_time', targetId: id });
}

// ---- Public booking flow ----

async function publishedType(username: string, slug: string) {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Not found');
  const bt = await BookingTypeModel.findOne({ creatorId: profile.userId, slug, status: 'published' });
  if (!bt) throw AppError.notFound('Booking type not found');
  return { profile, bt };
}

export async function getPublicBookingType(username: string, slug: string) {
  const { profile, bt } = await publishedType(username, slug);
  return { ...publicType(bt), creatorName: profile.displayName, username: profile.username };
}

export async function getAvailability(username: string, slug: string, fromIso?: string, toIso?: string) {
  const { bt } = await publishedType(username, slug);
  const slots = await computeSlots(bt, fromIso, toIso);
  return { timezone: bt.timezone, durationMin: bt.durationMin, slots };
}

function whenText(startAt: Date, zone: string): string {
  return DateTime.fromJSDate(startAt, { zone }).toFormat("cccc, LLL d 'at' h:mm a (ZZZZ)");
}

/**
 * Create a booking. Free sessions confirm immediately + email. Paid sessions
 * reserve the slot as pending_payment and return a Stripe checkout URL; the
 * webhook confirms them. The unique slot index prevents double-booking.
 */
export async function createBooking(input: {
  username: string;
  slug: string;
  email: string;
  name?: string;
  startIso: string;
  intakeAnswers?: { question: string; answer: string }[];
  provider?: 'stripe' | 'paypal';
}) {
  const { bt } = await publishedType(input.username, input.slug);
  const creatorId = String(bt.creatorId);

  if (!(await isSlotOpen(bt, input.startIso))) {
    throw AppError.conflict('That time is no longer available');
  }
  const startAt = new Date(input.startIso);
  const endAt = new Date(startAt.getTime() + bt.durationMin * 60_000);

  const paid = bt.priceCents > 0;
  const capacity = Math.max(1, bt.maxAttendees ?? 1);
  let booking: BookingDoc;
  try {
    booking = await BookingModel.create({
      creatorId,
      bookingTypeId: bt._id,
      buyerEmail: input.email.toLowerCase(),
      buyerName: input.name ?? '',
      intakeAnswers: input.intakeAnswers ?? [],
      startAt,
      endAt,
      timezone: bt.timezone,
      status: paid ? 'pending_payment' : 'confirmed',
      meetingUrl: paid ? '' : bt.meetingUrl,
    });
  } catch (err) {
    // Duplicate-key on {bookingTypeId, startAt, buyerEmail} means this buyer
    // already holds a seat in this slot; anything else is a real error.
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw AppError.conflict('You already have a booking for that time');
    }
    throw err;
  }

  // Race-safe capacity guard (this mongod is standalone, so no transactions).
  // ObjectIds are monotonic by creation, so counting active seats created at or
  // before this one gives each concurrent request a deterministic rank: exactly
  // the first `capacity` seats survive, the rest roll themselves back.
  const seatRank = await BookingModel.countDocuments({
    bookingTypeId: bt._id,
    startAt,
    status: { $in: ['confirmed', 'pending_payment'] },
    _id: { $lte: booking._id },
  });
  if (seatRank > capacity) {
    await BookingModel.deleteOne({ _id: booking._id });
    throw AppError.conflict('That time is fully booked');
  }

  if (!paid) {
    await sendBookingConfirmation(booking, bt);
    await upsertCustomerLead(creatorId, booking.buyerEmail, booking.buyerName).catch(() => {});
    recordAudit({ action: 'booking.created_free', actorType: 'anonymous', creatorId, targetType: 'booking', targetId: booking.id });
    return { status: 'confirmed' as const, manageToken: booking.manageToken };
  }

  // Paid: create a Stripe checkout session referencing this booking.
  const { createBookingCheckoutSession } = await import('../checkout/checkout.service');
  const checkout = await createBookingCheckoutSession({
    creatorId,
    bookingId: booking.id,
    title: bt.title,
    priceCents: bt.priceCents,
    currency: bt.currency,
    email: input.email,
    username: input.username,
    provider: input.provider ?? 'stripe',
  });
  booking.stripeCheckoutSessionId = checkout.sessionId;
  await booking.save();
  return { status: 'pending_payment' as const, checkoutUrl: checkout.url };
}

export async function sendBookingConfirmation(booking: BookingDoc, bt: BookingTypeDoc) {
  await enqueueEmail(booking.buyerEmail, 'booking_confirmation', {
    title: bt.title,
    whenText: whenText(booking.startAt, booking.timezone),
    meetingUrl: booking.meetingUrl || bt.meetingUrl || undefined,
    manageUrl: `${env.APP_URL}/booking/${booking.manageToken}`,
  });
  await scheduleBookingReminder(booking);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Schedule a "your booking is coming up" reminder. Fires 24h before the start;
 * if the booking is sooner than that, falls back to 1h before. Skipped entirely
 * if even that is already in the past. Idempotent per booking via dedupeKey.
 */
export async function scheduleBookingReminder(booking: BookingDoc): Promise<void> {
  const start = booking.startAt.getTime();
  const now = Date.now();
  let runAt: Date | null = null;
  if (start - DAY_MS > now) runAt = new Date(start - DAY_MS);
  else if (start - HOUR_MS > now) runAt = new Date(start - HOUR_MS);
  if (!runAt) return;
  await enqueueJob(
    'booking_reminder',
    { bookingId: booking.id },
    { runAt, dedupeKey: `booking_reminder:${booking.id}` },
  ).catch(() => {});
}

/** Job handler: send the reminder if the booking is still confirmed + upcoming. */
async function processBookingReminder(payload: Record<string, unknown>): Promise<void> {
  const booking = await BookingModel.findById(String(payload.bookingId ?? ''));
  if (!booking || booking.status !== 'confirmed' || booking.startAt.getTime() <= Date.now()) return;
  const bt = await BookingTypeModel.findById(booking.bookingTypeId);
  if (!bt) return;
  const mins = Math.round((booking.startAt.getTime() - Date.now()) / 60000);
  const startsInText = mins >= 90 ? `in about ${Math.round(mins / 60)} hours` : mins >= 45 ? 'in about an hour' : `in ${Math.max(1, mins)} minutes`;
  await enqueueEmail(booking.buyerEmail, 'booking_reminder', {
    title: bt.title,
    whenText: whenText(booking.startAt, booking.timezone),
    startsInText,
    meetingUrl: booking.meetingUrl || bt.meetingUrl || undefined,
    manageUrl: `${env.APP_URL}/booking/${booking.manageToken}`,
  });
}

/** Register booking job handlers with the runner (called at boot). */
export function registerBookingJobs(): void {
  registerJobHandler('booking_reminder', processBookingReminder);
}

/** Confirm a paid booking from its checkout session (called by fulfilment). */
export async function confirmBookingFromSession(session: Stripe.Checkout.Session, accountId?: string): Promise<void> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;
  const booking = await BookingModel.findById(bookingId);
  if (!booking || booking.status === 'confirmed') return;

  const bt = await BookingTypeModel.findById(booking.bookingTypeId);
  if (!bt) return;

  // Record an order for the booking too.
  let order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
  if (!order) {
    order = await OrderModel.create({
      creatorId: booking.creatorId,
      productId: booking.bookingTypeId,
      buyerEmail: booking.buyerEmail,
      amountCents: session.amount_total ?? bt.priceCents,
      currency: session.currency ?? bt.currency,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      stripeAccountId: accountId,
      paymentProvider: accountId?.startsWith('paypal') ? 'paypal' : 'stripe',
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      paidAt: new Date(),
    });
  }

  booking.status = 'confirmed';
  booking.meetingUrl = bt.meetingUrl;
  booking.set('orderId', order._id);
  await booking.save();
  await sendBookingConfirmation(booking, bt);
  await upsertCustomerLead(String(booking.creatorId), booking.buyerEmail, booking.buyerName).catch(() => {});
  recordAudit({ action: 'booking.confirmed_paid', actorType: 'system', creatorId: String(booking.creatorId), targetType: 'booking', targetId: booking.id });
}

export async function getBookingByToken(token: string) {
  const booking = await BookingModel.findOne({ manageToken: token });
  if (!booking) throw AppError.notFound('Booking not found');
  const bt = await BookingTypeModel.findById(booking.bookingTypeId);
  return {
    id: booking.id,
    title: bt?.title ?? '',
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.timezone,
    status: booking.status,
    meetingUrl: booking.meetingUrl,
    whenText: whenText(booking.startAt, booking.timezone),
  };
}

export async function cancelBooking(token: string): Promise<void> {
  const booking = await BookingModel.findOne({ manageToken: token });
  if (!booking || booking.status === 'cancelled') return;
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();
  recordAudit({ action: 'booking.cancelled', actorType: 'anonymous', creatorId: String(booking.creatorId), targetType: 'booking', targetId: booking.id });
}

// A paid booking sits in `pending_payment` while the buyer is at Stripe. If they
// abandon checkout the slot would otherwise be held forever, so we release it
// after this window. Stripe sessions live ~24h, but the slot hold should free up
// much sooner so other buyers can grab it.
const PENDING_BOOKING_TTL_MS = 30 * 60 * 1000; // 30 minutes
let bookingSweepTimer: NodeJS.Timeout | null = null;

/**
 * Cancel abandoned `pending_payment` bookings older than the TTL, releasing
 * their slot. Idempotent and safe to run from multiple processes.
 */
export async function expireStalePendingBookings(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_BOOKING_TTL_MS);
  const res = await BookingModel.updateMany(
    { status: 'pending_payment', createdAt: { $lt: cutoff } },
    { $set: { status: 'cancelled', cancelledAt: new Date() } },
  );
  const n = res.modifiedCount ?? 0;
  if (n > 0) {
    recordAudit({ action: 'booking.pending_expired', actorType: 'system', metadata: { count: n } });
  }
  return n;
}

/** Start the periodic sweep that expires abandoned pending bookings. */
export function startBookingMaintenance(): void {
  if (bookingSweepTimer) return;
  // Run once on boot to catch anything stranded during downtime, then on an interval.
  void expireStalePendingBookings().catch(() => undefined);
  bookingSweepTimer = setInterval(() => void expireStalePendingBookings().catch(() => undefined), 5 * 60 * 1000);
}

export function stopBookingMaintenance(): void {
  if (bookingSweepTimer) {
    clearInterval(bookingSweepTimer);
    bookingSweepTimer = null;
  }
}

/** Published booking types for a storefront. */
export async function listPublicBookingTypes(creatorId: string) {
  const items = await BookingTypeModel.find({ creatorId, status: 'published' }).sort({ createdAt: -1 });
  return items.map((bt) => ({
    id: bt.id,
    title: bt.title,
    slug: bt.slug,
    description: bt.description,
    durationMin: bt.durationMin,
    priceCents: bt.priceCents,
    currency: bt.currency,
  }));
}
