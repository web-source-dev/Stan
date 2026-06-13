import crypto from 'node:crypto';
import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A buyer's access to a course + their progress. Keyed by (buyerEmail, courseId)
 * so a repeat purchase doesn't duplicate enrollment. `accessToken` is the
 * unguessable handle emailed to the buyer that backs the course player (buyers
 * are not authenticated accounts).
 */
const enrollmentSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Types.ObjectId, ref: 'Course', required: true },
    orderId: { type: Types.ObjectId, ref: 'Order' },
    buyerEmail: { type: String, required: true, lowercase: true, trim: true },

    accessToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(32).toString('base64url'),
    },

    completedLessonIds: { type: [Types.ObjectId], default: [] },
    lastLessonId: { type: Types.ObjectId, ref: 'CourseLesson' },

    revokedAt: { type: Date },
    enrolledAt: { type: Date, default: Date.now },
    lastAccessedAt: { type: Date },
  },
  { timestamps: true },
);

enrollmentSchema.index({ buyerEmail: 1, courseId: 1 }, { unique: true });

export type Enrollment = InferSchemaType<typeof enrollmentSchema>;
export type EnrollmentDoc = HydratedDocument<Enrollment>;
export const EnrollmentModel = model('Enrollment', enrollmentSchema);
