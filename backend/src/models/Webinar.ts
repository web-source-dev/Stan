import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const webinarSlotSchema = new Schema(
  {
    startsAt: { type: Date, required: true },
  },
  { _id: true },
);

const webinarEmailFlowStepSchema = new Schema(
  {
    dayOffset: { type: Number, required: true, min: 0, max: 365 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    enabled: { type: Boolean, default: true },
  },
  { _id: true },
);

const webinarCustomFieldSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ['text', 'textarea', 'phone'], default: 'text' },
    required: { type: Boolean, default: false },
  },
  { _id: true },
);

const webinarSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    shortDescription: { type: String, maxlength: 300, default: '' },
    description: { type: String, maxlength: 5000, default: '' },

    priceCents: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'usd', lowercase: true },
    discountPriceCents: { type: Number, default: 0, min: 0 },
    discountEnabled: { type: Boolean, default: false },

    coverImageUrl: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },

    thumbnailStyle: { type: String, enum: ['button', 'callout', 'preview'], default: 'callout' },
    thumbnailButtonLabel: { type: String, maxlength: 80, default: '' },
    bottomTitle: { type: String, maxlength: 140, default: '' },
    ctaLabel: { type: String, maxlength: 80, default: 'Secure Your Spot' },

    slots: { type: [webinarSlotSchema], default: [] },
    durationMin: { type: Number, default: 30, min: 15, max: 240 },
    timezone: { type: String, maxlength: 80, default: 'Asia/Shanghai' },
    calendarIntegration: { type: String, maxlength: 80, default: 'default' },
    capacityPerSlot: { type: Number, default: 50, min: 1, max: 10_000 },

    reminderEnabled: { type: Boolean, default: true },
    reminderHoursBefore: { type: Number, default: 24, min: 1, max: 168 },

    emailFlows: { type: [webinarEmailFlowStepSchema], default: [] },
    customFields: { type: [webinarCustomFieldSchema], default: [] },
    confirmSubject: { type: String, maxlength: 200, default: 'Your webinar spot is confirmed' },
    confirmBody: { type: String, maxlength: 5000, default: '' },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },

    registrationCount: { type: Number, default: 0 },
    grossCents: { type: Number, default: 0 },
  },
  { timestamps: true },
);

webinarSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

export type Webinar = InferSchemaType<typeof webinarSchema>;
export type WebinarDoc = HydratedDocument<Webinar>;
export const WebinarModel = model('Webinar', webinarSchema);
