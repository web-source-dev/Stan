import { AppError } from '../../utils/AppError';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { CourseModel, CourseModuleModel, CourseLessonModel } from '../../models/Course';
import { EnrollmentModel, type EnrollmentDoc } from '../../models/Enrollment';
import { enrollBuyer } from '../checkout/fulfilment.service';

async function resolveEnrollment(token: string): Promise<EnrollmentDoc> {
  const e = await EnrollmentModel.findOne({ accessToken: token });
  if (!e || e.revokedAt) throw AppError.notFound('Access not found or revoked');
  return e;
}

/** Enroll into a FREE published course; returns the access token. */
export async function enrollFree(username: string, slug: string, email: string) {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Course not found');
  const creatorId = String(profile.userId);
  const course = await CourseModel.findOne({ creatorId, slug, status: 'published' });
  if (!course) throw AppError.notFound('Course not found');
  if (course.priceCents > 0) throw AppError.badRequest('This course is paid; please check out');

  const already = await EnrollmentModel.exists({ buyerEmail: email.toLowerCase(), courseId: course.id });
  const enrollment = await enrollBuyer(creatorId, course.id, email.toLowerCase());
  if (!already) await CourseModel.updateOne({ _id: course.id }, { $inc: { enrollmentCount: 1 } });
  return { accessToken: enrollment.accessToken };
}

/** Player data for an enrolled buyer: full structure + progress. */
export async function getPlayer(token: string) {
  const enrollment = await resolveEnrollment(token);
  enrollment.lastAccessedAt = new Date();
  await enrollment.save();

  const course = await CourseModel.findById(enrollment.courseId);
  if (!course) throw AppError.notFound('Course no longer available');
  const modules = await CourseModuleModel.find({ courseId: course.id }).sort({ sortOrder: 1 });
  const lessons = await CourseLessonModel.find({ courseId: course.id }).sort({ sortOrder: 1 });
  const completed = new Set(enrollment.completedLessonIds.map(String));

  return {
    course: { id: course.id, title: course.title, shortDescription: course.shortDescription, coverImageUrl: course.coverImageUrl },
    progress: {
      completed: completed.size,
      total: lessons.length,
      lastLessonId: enrollment.lastLessonId ? String(enrollment.lastLessonId) : null,
    },
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: lessons
        .filter((l) => String(l.moduleId) === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          durationSec: l.durationSec,
          textContent: l.type === 'text' ? l.textContent : undefined,
          hasVideo: Boolean(l.videoPublicId),
          hasDownload: Boolean(l.assetPublicId),
          completed: completed.has(l.id),
        })),
    })),
  };
}

/** Mark a lesson complete/incomplete for the enrolled buyer. */
export async function setLessonComplete(token: string, lessonId: string, complete: boolean) {
  const enrollment = await resolveEnrollment(token);
  const lesson = await CourseLessonModel.findOne({ _id: lessonId, courseId: enrollment.courseId });
  if (!lesson) throw AppError.notFound('Lesson not found');

  if (complete) {
    await EnrollmentModel.updateOne(
      { _id: enrollment.id },
      { $addToSet: { completedLessonIds: lesson._id }, $set: { lastLessonId: lesson._id } },
    );
  } else {
    await EnrollmentModel.updateOne({ _id: enrollment.id }, { $pull: { completedLessonIds: lesson._id } });
  }
  const updated = await EnrollmentModel.findById(enrollment.id);
  return { completed: updated?.completedLessonIds.length ?? 0 };
}

/** Resolve a lesson's Cloudinary asset reference for signed delivery. */
export async function getLessonAsset(token: string, lessonId: string) {
  const enrollment = await resolveEnrollment(token);
  const lesson = await CourseLessonModel.findOne({ _id: lessonId, courseId: enrollment.courseId });
  if (!lesson) throw AppError.notFound('Lesson not found');
  const publicId = lesson.videoPublicId || lesson.assetPublicId;
  if (!publicId) throw AppError.notFound('No media for this lesson');
  const resourceType = lesson.videoPublicId ? 'video' : lesson.assetResourceType;
  return { publicId, resourceType };
}
