import crypto from 'node:crypto';
import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** A weekly recurring availability window (local to the booking type's timezone). */
const weeklyWindowSchema = new Schema(
  {
    weekday: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    startMinute: { type: Number, min: 0, max: 1440, required: true }, // minutes from midnight
    endMinute: { type: Number, min: 0, max: 1440, required: true },
  },
  { _id: false },
);

/**
 * A productised service a creator offers. Availability is defined by weekly
 * windows plus scheduling guardrails (notice, horizon, buffers, daily cap).
 * Per the PRD decision, meeting links are manual for MVP (provider integrations
 * deferred); the provider-agnostic fields are reserved here.
 */
const bookingTypeSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 2000, default: '' },

    durationMin: { type: Number, default: 30, min: 5, max: 600 },
    priceCents: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'usd', lowercase: true },

    timezone: { type: String, default: 'UTC' },
    weeklyWindows: { type: [weeklyWindowSchema], default: [] },

    minNoticeMin: { type: Number, default: 720 }, // 12h
    maxHorizonDays: { type: Number, default: 30 },
    bufferBeforeMin: { type: Number, default: 0 },
    bufferAfterMin: { type: Number, default: 0 },
    dailyCap: { type: Number, default: 0 }, // 0 = unlimited

    meetingProvider: { type: String, enum: ['manual', 'google', 'zoom'], default: 'manual' },
    meetingUrl: { type: String, default: '' },

    intakeQuestions: { type: [String], default: [] },

    /** Storefront / checkout page (Stan coaching-call editor). */
    shortDescription: { type: String, maxlength: 500, default: '' },
    bottomTitle: { type: String, maxlength: 140, default: '' },
    ctaLabel: { type: String, maxlength: 80, default: 'Book a Call' },
    coverImageUrl: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },
    thumbnailStyle: { type: String, enum: ['button', 'callout', 'preview'], default: 'callout' },
    thumbnailButtonLabel: { type: String, maxlength: 80, default: '' },
    discountPriceCents: { type: Number, default: 0, min: 0 },
    discountEnabled: { type: Boolean, default: false },
    maxAttendees: { type: Number, default: 1, min: 1, max: 100 },
    calendarLabel: { type: String, default: 'Default', maxlength: 80 },
    bufferBeforeEnabled: { type: Boolean, default: false },
    bufferAfterEnabled: { type: Boolean, default: false },
    confirmSubject: { type: String, default: 'Your booking is confirmed' },
    confirmBody: { type: String, default: '' },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  },
  { timestamps: true },
);
bookingTypeSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

export type BookingType = InferSchemaType<typeof bookingTypeSchema>;
export type BookingTypeDoc = HydratedDocument<BookingType>;
export const BookingTypeModel = model('BookingType', bookingTypeSchema);

/**
 * A scheduled appointment. `startAt` is an absolute instant (UTC). Paid bookings
 * stay `pending_payment` until the webhook confirms payment. The unique
 * (bookingTypeId, startAt) index for confirmed slots prevents double-booking.
 */
const bookingSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    bookingTypeId: { type: Types.ObjectId, ref: 'BookingType', required: true, index: true },

    buyerEmail: { type: String, required: true, lowercase: true, trim: true },
    buyerName: { type: String, default: '' },
    intakeAnswers: { type: [{ question: String, answer: String }], default: [] },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },

    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    orderId: { type: Types.ObjectId, ref: 'Order' },
    stripeCheckoutSessionId: { type: String },

    meetingUrl: { type: String, default: '' },
    manageToken: { type: String, default: () => crypto.randomBytes(24).toString('base64url'), index: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);
// One attendee can hold at most one active seat in a given slot — prevents a
// double-submit from the same buyer. Multiple *different* attendees may share a
// slot up to the booking type's maxAttendees (capacity enforced in the service),
// which is why the slot itself is no longer globally unique.
bookingSchema.index(
  { bookingTypeId: 1, startAt: 1, buyerEmail: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['confirmed', 'pending_payment'] } } },
);
// Fast per-slot capacity counting and availability lookups.
bookingSchema.index({ bookingTypeId: 1, startAt: 1, status: 1 });

export type Booking = InferSchemaType<typeof bookingSchema>;
export type BookingDoc = HydratedDocument<Booking>;
export const BookingModel = model('Booking', bookingSchema);

/**
 * A creator-wide block of unavailable time (vacation, a one-off meeting, lunch).
 * Stored as an absolute UTC interval so it removes overlapping slots from every
 * booking type's public availability, regardless of each type's timezone.
 */
const blockedTimeSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    note: { type: String, default: '', maxlength: 200, trim: true },
  },
  { timestamps: true },
);

export type BlockedTime = InferSchemaType<typeof blockedTimeSchema>;
export type BlockedTimeDoc = HydratedDocument<BlockedTime>;
export const BlockedTimeModel = model('BlockedTime', blockedTimeSchema);
