import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A sellable course. Structured content (modules/lessons) lives in separate
 * collections; access is granted via Enrollment, not the product Entitlement
 * path. Price in minor units; a free course (priceCents 0) enrolls without
 * payment.
 */
const courseSchema = new Schema(
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
    billingInterval: { type: String, enum: ['one_time', 'month', 'year'], default: 'one_time' },

    coverImageUrl: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },

    /** Storefront thumbnail card */
    thumbnailStyle: { type: String, enum: ['button', 'callout', 'preview'], default: 'callout' },
    thumbnailButtonLabel: { type: String, maxlength: 80, default: '' },
    bottomTitle: { type: String, maxlength: 140, default: '' },
    ctaLabel: { type: String, maxlength: 80, default: 'PURCHASE' },

    /** Course player homepage (inside the course after purchase) */
    homepageTitle: { type: String, maxlength: 140, default: '' },
    homepageDescription: { type: String, maxlength: 5000, default: '' },
    homepageCoverImageUrl: { type: String, default: '' },
    homepageCoverPublicId: { type: String, default: '' },
    titleFont: { type: String, maxlength: 80, default: 'Plus Jakarta Sans' },
    backgroundColor: { type: String, maxlength: 20, default: '#f3f6fd' },
    highlightColor: { type: String, maxlength: 20, default: '#6355FF' },

    confirmSubject: { type: String, maxlength: 200, default: 'Your course enrollment is confirmed' },
    confirmBody: { type: String, maxlength: 5000, default: '' },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },

    enrollmentCount: { type: Number, default: 0 },
    grossCents: { type: Number, default: 0 },
  },
  { timestamps: true },
);

courseSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

export type Course = InferSchemaType<typeof courseSchema>;
export type CourseDoc = HydratedDocument<Course>;
export const CourseModel = model('Course', courseSchema);

/** Ordered grouping of lessons within a course. */
const courseModuleSchema = new Schema(
  {
    courseId: { type: Types.ObjectId, ref: 'Course', required: true, index: true },
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
  },
  { timestamps: true },
);
courseModuleSchema.index({ courseId: 1, sortOrder: 1 });

export type CourseModuleType = InferSchemaType<typeof courseModuleSchema>;
export type CourseModuleDoc = HydratedDocument<CourseModuleType>;
export const CourseModuleModel = model('CourseModule', courseModuleSchema);

/** A single lesson. `preview` lessons are viewable before purchase. */
const courseLessonSchema = new Schema(
  {
    courseId: { type: Types.ObjectId, ref: 'Course', required: true, index: true },
    moduleId: { type: Types.ObjectId, ref: 'CourseModule', required: true, index: true },
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['video', 'text', 'download'], default: 'video' },
    preview: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    sortOrder: { type: Number, default: 0 },

    durationSec: { type: Number, default: 0 },
    textContent: { type: String, default: '' },

    videoPublicId: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    assetPublicId: { type: String, default: '' },
    assetResourceType: { type: String, enum: ['raw', 'video', 'image'], default: 'video' },
    assetFilename: { type: String, default: '' },
  },
  { timestamps: true },
);
courseLessonSchema.index({ courseId: 1, moduleId: 1, sortOrder: 1 });

export type CourseLessonType = InferSchemaType<typeof courseLessonSchema>;
export type CourseLessonDoc = HydratedDocument<CourseLessonType>;
export const CourseLessonModel = model('CourseLesson', courseLessonSchema);
