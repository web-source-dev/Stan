import { AppError } from '../../utils/AppError';
import {
  CourseModel,
  CourseModuleModel,
  CourseLessonModel,
  type CourseDoc,
} from '../../models/Course';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { uniqueSlug } from '../../lib/slug';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';

function publicCourse(c: CourseDoc) {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription,
    description: c.description,
    priceCents: c.priceCents,
    currency: c.currency,
    coverImageUrl: c.coverImageUrl,
    status: c.status,
    enrollmentCount: c.enrollmentCount,
    grossCents: c.grossCents,
    createdAt: c.get('createdAt'),
  };
}

async function owned(creatorId: string, id: string): Promise<CourseDoc> {
  const course = await CourseModel.findOne({ _id: id, creatorId });
  if (!course) throw AppError.notFound('Course not found');
  return course;
}

export async function createCourse(
  creatorId: string,
  input: { title: string; shortDescription?: string; description?: string; priceCents?: number; coverImageUrl?: string; coverPublicId?: string },
) {
  const slug = await uniqueSlug(input.title, async (c) => Boolean(await CourseModel.exists({ creatorId, slug: c })));
  const course = await CourseModel.create({
    creatorId,
    title: input.title,
    slug,
    shortDescription: input.shortDescription ?? '',
    description: input.description ?? '',
    priceCents: input.priceCents ?? 0,
    coverImageUrl: input.coverImageUrl ?? '',
    coverPublicId: input.coverPublicId ?? '',
  });
  recordAudit({ action: 'course.created', actorId: creatorId, actorType: 'user', creatorId, targetType: 'course', targetId: course.id });
  return publicCourse(course);
}

export async function listCourses(creatorId: string) {
  const courses = await CourseModel.find({ creatorId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  return courses.map(publicCourse);
}

export async function updateCourse(creatorId: string, id: string, patch: Record<string, unknown>) {
  const course = await owned(creatorId, id);
  for (const f of ['title', 'shortDescription', 'description', 'priceCents', 'coverImageUrl', 'coverPublicId'] as const) {
    if (patch[f] !== undefined) (course as unknown as Record<string, unknown>)[f] = patch[f];
  }
  await course.save();
  return publicCourse(course);
}

export async function publishCourse(creatorId: string, id: string) {
  const course = await owned(creatorId, id);
  if (course.priceCents > 0 && !(await canAcceptPayments(creatorId))) {
    throw new AppError(409, 'payments_not_ready', 'Connect a payout account before publishing a paid course');
  }
  const lessonCount = await CourseLessonModel.countDocuments({ courseId: id });
  if (lessonCount === 0) throw AppError.badRequest('Add at least one lesson before publishing');
  course.status = 'published';
  await course.save();
  recordAudit({ action: 'course.published', actorId: creatorId, actorType: 'user', creatorId, targetType: 'course', targetId: course.id });
  return publicCourse(course);
}

export async function setCourseStatus(creatorId: string, id: string, status: 'draft' | 'archived') {
  const course = await owned(creatorId, id);
  course.status = status;
  await course.save();
  return publicCourse(course);
}

/** Full course tree for the creator editor (modules + lessons). */
export async function getCourseTree(creatorId: string, id: string) {
  const course = await owned(creatorId, id);
  const modules = await CourseModuleModel.find({ courseId: id }).sort({ sortOrder: 1 });
  const lessons = await CourseLessonModel.find({ courseId: id }).sort({ sortOrder: 1 });
  return {
    course: publicCourse(course),
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      lessons: lessons
        .filter((l) => String(l.moduleId) === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          preview: l.preview,
          sortOrder: l.sortOrder,
          durationSec: l.durationSec,
          textContent: l.textContent,
          assetFilename: l.assetFilename,
          hasVideo: Boolean(l.videoPublicId),
          hasAsset: Boolean(l.assetPublicId),
        })),
    })),
  };
}

export async function addModule(creatorId: string, courseId: string, title: string) {
  await owned(creatorId, courseId);
  const count = await CourseModuleModel.countDocuments({ courseId });
  const m = await CourseModuleModel.create({ courseId, creatorId, title, sortOrder: count });
  return { id: m.id, title: m.title, sortOrder: m.sortOrder };
}

export async function addLesson(
  creatorId: string,
  courseId: string,
  moduleId: string,
  input: { title: string; type?: 'video' | 'text' | 'download'; preview?: boolean; textContent?: string; videoPublicId?: string; assetPublicId?: string; assetResourceType?: 'raw' | 'video' | 'image'; assetFilename?: string; durationSec?: number },
) {
  await owned(creatorId, courseId);
  const module = await CourseModuleModel.findOne({ _id: moduleId, courseId });
  if (!module) throw AppError.notFound('Module not found');
  const count = await CourseLessonModel.countDocuments({ moduleId });
  const lesson = await CourseLessonModel.create({
    courseId, moduleId, creatorId,
    title: input.title,
    type: input.type ?? 'video',
    preview: input.preview ?? false,
    sortOrder: count,
    textContent: input.textContent ?? '',
    videoPublicId: input.videoPublicId ?? '',
    assetPublicId: input.assetPublicId ?? '',
    assetResourceType: input.assetResourceType ?? 'video',
    assetFilename: input.assetFilename ?? '',
    durationSec: input.durationSec ?? 0,
  });
  return { id: lesson.id, title: lesson.title, type: lesson.type, preview: lesson.preview };
}

export async function updateLesson(creatorId: string, lessonId: string, patch: Record<string, unknown>) {
  const lesson = await CourseLessonModel.findOne({ _id: lessonId, creatorId });
  if (!lesson) throw AppError.notFound('Lesson not found');
  for (const f of ['title', 'type', 'preview', 'textContent', 'videoPublicId', 'assetPublicId', 'assetResourceType', 'assetFilename', 'durationSec'] as const) {
    if (patch[f] !== undefined) (lesson as unknown as Record<string, unknown>)[f] = patch[f];
  }
  await lesson.save();
  return { id: lesson.id, title: lesson.title, type: lesson.type, preview: lesson.preview };
}

/** Reorder modules or lessons by id list. */
export async function reorder(creatorId: string, kind: 'modules' | 'lessons', ids: string[]) {
  const update = (id: string, i: number) =>
    kind === 'modules'
      ? CourseModuleModel.updateOne({ _id: id, creatorId }, { $set: { sortOrder: i } })
      : CourseLessonModel.updateOne({ _id: id, creatorId }, { $set: { sortOrder: i } });
  await Promise.all(ids.map(update));
  return { ok: true };
}

export async function deleteLesson(creatorId: string, lessonId: string) {
  await CourseLessonModel.deleteOne({ _id: lessonId, creatorId });
  return { ok: true };
}

/** Public course landing: structure with preview flags, no protected URLs. */
export async function getPublicCourse(username: string, slug: string) {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Course not found');
  const course = await CourseModel.findOne({ creatorId: profile.userId, slug, status: 'published' });
  if (!course) throw AppError.notFound('Course not found');
  const modules = await CourseModuleModel.find({ courseId: course.id }).sort({ sortOrder: 1 });
  const lessons = await CourseLessonModel.find({ courseId: course.id }).sort({ sortOrder: 1 });
  return {
    course: { ...publicCourse(course), creatorName: profile.displayName, username: profile.username },
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: lessons
        .filter((l) => String(l.moduleId) === m.id)
        .map((l) => ({ id: l.id, title: l.title, type: l.type, preview: l.preview, durationSec: l.durationSec })),
    })),
  };
}

/** Published courses for a storefront. */
export async function listPublicCourses(creatorId: string) {
  const courses = await CourseModel.find({ creatorId, status: 'published' }).sort({ createdAt: -1 });
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription,
    priceCents: c.priceCents,
    currency: c.currency,
    coverImageUrl: c.coverImageUrl,
  }));
}
