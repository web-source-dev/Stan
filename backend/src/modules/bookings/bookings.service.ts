import { DateTime } from 'luxon';
import type Stripe from 'stripe';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { BookingTypeModel, BookingModel, type BookingTypeDoc, type BookingDoc } from '../../models/Booking';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { OrderModel } from '../../models/Order';
import { uniqueSlug } from '../../lib/slug';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';
import { computeSlots, isSlotOpen } from './availability';

function publicType(bt: BookingTypeDoc) {
  return {
    id: bt.id,
    title: bt.title,
    slug: bt.slug,
    description: bt.description,
    durationMin: bt.durationMin,
    priceCents: bt.priceCents,
    currency: bt.currency,
    timezone: bt.timezone,
    status: bt.status,
    meetingProvider: bt.meetingProvider,
    intakeQuestions: bt.intakeQuestions,
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

export async function listBookingTypes(creatorId: string) {
  const items = await BookingTypeModel.find({ creatorId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  return items.map(publicType);
}

export async function updateBookingType(creatorId: string, id: string, patch: Record<string, unknown>) {
  const bt = await owned(creatorId, id);
  const fields = ['title', 'description', 'durationMin', 'priceCents', 'currency', 'timezone',
    'weeklyWindows', 'minNoticeMin', 'maxHorizonDays', 'bufferBeforeMin', 'bufferAfterMin',
    'dailyCap', 'meetingProvider', 'meetingUrl', 'intakeQuestions'] as const;
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
  const bookings = await BookingModel.find({ creatorId, status: { $ne: 'cancelled' } })
    .sort({ startAt: 1 })
    .populate('bookingTypeId', 'title')
    .limit(200);
  return bookings.map((b) => ({
    id: b.id,
    title: (b.bookingTypeId as unknown as { title?: string })?.title ?? '',
    buyerEmail: b.buyerEmail,
    buyerName: b.buyerName,
    startAt: b.startAt,
    endAt: b.endAt,
    status: b.status,
    meetingUrl: b.meetingUrl,
  }));
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
}) {
  const { bt } = await publishedType(input.username, input.slug);
  const creatorId = String(bt.creatorId);

  if (!(await isSlotOpen(bt, input.startIso))) {
    throw AppError.conflict('That time is no longer available');
  }
  const startAt = new Date(input.startIso);
  const endAt = new Date(startAt.getTime() + bt.durationMin * 60_000);

  const paid = bt.priceCents > 0;
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
  } catch {
    throw AppError.conflict('That time was just taken');
  }

  if (!paid) {
    await sendBookingConfirmation(booking, bt);
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
