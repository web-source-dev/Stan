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
// Prevents two active bookings on the same slot of the same booking type.
bookingSchema.index(
  { bookingTypeId: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['confirmed', 'pending_payment'] } } },
);

export type Booking = InferSchemaType<typeof bookingSchema>;
export type BookingDoc = HydratedDocument<Booking>;
export const BookingModel = model('Booking', bookingSchema);
