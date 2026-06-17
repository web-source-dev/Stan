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
    discountPriceCents: c.discountPriceCents,
    discountEnabled: c.discountEnabled,
    billingInterval: c.billingInterval,
    coverImageUrl: c.coverImageUrl,
    coverPublicId: c.coverPublicId,
    thumbnailStyle: c.thumbnailStyle,
    thumbnailButtonLabel: c.thumbnailButtonLabel,
    bottomTitle: c.bottomTitle,
    ctaLabel: c.ctaLabel,
    homepageTitle: c.homepageTitle,
    homepageDescription: c.homepageDescription,
    homepageCoverImageUrl: c.homepageCoverImageUrl,
    homepageCoverPublicId: c.homepageCoverPublicId,
    titleFont: c.titleFont,
    backgroundColor: c.backgroundColor,
    highlightColor: c.highlightColor,
    confirmSubject: c.confirmSubject,
    confirmBody: c.confirmBody,
    status: c.status,
    enrollmentCount: c.enrollmentCount,
    grossCents: c.grossCents,
    createdAt: c.get('createdAt'),
  };
}

const COURSE_PATCH_FIELDS = [
  'title', 'shortDescription', 'description', 'priceCents', 'coverImageUrl', 'coverPublicId',
  'discountPriceCents', 'discountEnabled', 'billingInterval',
  'thumbnailStyle', 'thumbnailButtonLabel', 'bottomTitle', 'ctaLabel',
  'homepageTitle', 'homepageDescription', 'homepageCoverImageUrl', 'homepageCoverPublicId',
  'titleFont', 'backgroundColor', 'highlightColor',
  'confirmSubject', 'confirmBody',
] as const;

async function owned(creatorId: string, id: string): Promise<CourseDoc> {
  const course = await CourseModel.findOne({ _id: id, creatorId });
  if (!course) throw AppError.notFound('Course not found');
  return course;
}

async function seedDefaultStructure(creatorId: string, courseId: string) {
  const m1 = await CourseModuleModel.create({
    courseId,
    creatorId,
    title: 'Module 1: Introduction',
    sortOrder: 0,
    status: 'published',
  });
  await CourseLessonModel.create([
    {
      courseId,
      moduleId: m1.id,
      creatorId,
      title: 'Lesson 1: Welcome',
      type: 'video',
      sortOrder: 0,
      status: 'published',
      textContent:
        'Welcome to the course! In this lesson we will cover what you can expect.\n\n**Key takeaways:**\n• Understand the course structure\n• Know how to get the most from each module\n• Set your learning goals',
    },
    {
      courseId,
      moduleId: m1.id,
      creatorId,
      title: 'Lesson 2: Course Overview',
      type: 'video',
      sortOrder: 1,
      status: 'draft',
    },
  ]);
  await CourseModuleModel.create([
    { courseId, creatorId, title: 'Module 2: Topic 1', sortOrder: 1, status: 'published' },
    { courseId, creatorId, title: 'Module 3: Topic 2', sortOrder: 2, status: 'published' },
  ]);
}

export async function createCourse(creatorId: string, input: Record<string, unknown>) {
  const title = String(input.title || 'Get started with this amazing course');
  const slug = await uniqueSlug(title, async (c) => Boolean(await CourseModel.exists({ creatorId, slug: c })));
  const course = await CourseModel.create({
    creatorId,
    slug,
    title,
    shortDescription: (input.shortDescription as string) ?? '',
    description: (input.description as string) ?? '',
    priceCents: (input.priceCents as number) ?? 999,
    coverImageUrl: (input.coverImageUrl as string) ?? '',
    coverPublicId: (input.coverPublicId as string) ?? '',
    thumbnailStyle: (input.thumbnailStyle as string) ?? 'callout',
    thumbnailButtonLabel: (input.thumbnailButtonLabel as string) ?? 'GET MY COURSE',
    bottomTitle: (input.bottomTitle as string) ?? 'Get My Course',
    ctaLabel: (input.ctaLabel as string) ?? 'PURCHASE',
    homepageTitle: (input.homepageTitle as string) ?? 'My 12-week Program',
    homepageDescription: (input.homepageDescription as string) ?? '',
    homepageCoverImageUrl: (input.homepageCoverImageUrl as string) ?? (input.coverImageUrl as string) ?? '',
    backgroundColor: (input.backgroundColor as string) ?? '#f3f6fd',
    highlightColor: (input.highlightColor as string) ?? '#6355FF',
    billingInterval: (input.billingInterval as string) ?? 'one_time',
    discountPriceCents: (input.discountPriceCents as number) ?? 0,
    discountEnabled: (input.discountEnabled as boolean) ?? false,
    confirmSubject: (input.confirmSubject as string) ?? 'Your course enrollment is confirmed',
    confirmBody: (input.confirmBody as string) ?? '',
  });
  await seedDefaultStructure(creatorId, course.id);
  recordAudit({ action: 'course.created', actorId: creatorId, actorType: 'user', creatorId, targetType: 'course', targetId: course.id });
  return publicCourse(course);
}

export async function listCourses(creatorId: string) {
  const courses = await CourseModel.find({ creatorId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  return courses.map(publicCourse);
}

export async function updateCourse(creatorId: string, id: string, patch: Record<string, unknown>) {
  const course = await owned(creatorId, id);
  for (const f of COURSE_PATCH_FIELDS) {
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
      status: m.status,
      lessons: lessons
        .filter((l) => String(l.moduleId) === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          preview: l.preview,
          status: l.status,
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

export async function getLesson(creatorId: string, lessonId: string) {
  const lesson = await CourseLessonModel.findOne({ _id: lessonId, creatorId });
  if (!lesson) throw AppError.notFound('Lesson not found');
  const course = await owned(creatorId, String(lesson.courseId));
  const module = await CourseModuleModel.findById(lesson.moduleId);
  const moduleLessons = await CourseLessonModel.find({ moduleId: lesson.moduleId }).sort({ sortOrder: 1 });
  const idx = moduleLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = idx >= 0 && idx < moduleLessons.length - 1 ? moduleLessons[idx + 1] : null;
  return {
    lesson: {
      id: lesson.id,
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      title: lesson.title,
      type: lesson.type,
      preview: lesson.preview,
      status: lesson.status,
      textContent: lesson.textContent,
      videoPublicId: lesson.videoPublicId,
      videoUrl: lesson.videoUrl,
      assetPublicId: lesson.assetPublicId,
      assetResourceType: lesson.assetResourceType,
      assetFilename: lesson.assetFilename,
      durationSec: lesson.durationSec,
    },
    course: { id: course.id, title: course.title, slug: course.slug, highlightColor: course.highlightColor },
    module: module ? { id: module.id, title: module.title } : null,
    nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
  };
}

export async function addModule(creatorId: string, courseId: string, title: string) {
  await owned(creatorId, courseId);
  const count = await CourseModuleModel.countDocuments({ courseId });
  const m = await CourseModuleModel.create({ courseId, creatorId, title, sortOrder: count, status: 'published' });
  return { id: m.id, title: m.title, sortOrder: m.sortOrder, status: m.status };
}

export async function updateModule(creatorId: string, moduleId: string, patch: { title?: string; status?: 'draft' | 'published' }) {
  const module = await CourseModuleModel.findOne({ _id: moduleId, creatorId });
  if (!module) throw AppError.notFound('Module not found');
  if (patch.title !== undefined) module.title = patch.title;
  if (patch.status !== undefined) module.status = patch.status;
  await module.save();
  return { id: module.id, title: module.title, status: module.status };
}

export async function addLesson(
  creatorId: string,
  courseId: string,
  moduleId: string,
  input: {
    title: string;
    type?: 'video' | 'text' | 'download';
    preview?: boolean;
    status?: 'draft' | 'published';
    textContent?: string;
    videoPublicId?: string;
    videoUrl?: string;
    assetPublicId?: string;
    assetResourceType?: 'raw' | 'video' | 'image';
    assetFilename?: string;
    durationSec?: number;
  },
) {
  await owned(creatorId, courseId);
  const module = await CourseModuleModel.findOne({ _id: moduleId, courseId });
  if (!module) throw AppError.notFound('Module not found');
  // Use max(sortOrder)+1 rather than a count, so a prior delete (which leaves a
  // gap) can't produce a duplicate sortOrder that breaks ordering/next-lesson.
  const last = await CourseLessonModel.findOne({ moduleId }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  const nextSort = last ? last.sortOrder + 1 : 0;
  const lesson = await CourseLessonModel.create({
    courseId,
    moduleId,
    creatorId,
    title: input.title,
    type: input.type ?? 'video',
    preview: input.preview ?? false,
    status: input.status ?? 'draft',
    sortOrder: nextSort,
    textContent: input.textContent ?? '',
    videoPublicId: input.videoPublicId ?? '',
    videoUrl: input.videoUrl ?? '',
    assetPublicId: input.assetPublicId ?? '',
    assetResourceType: input.assetResourceType ?? 'video',
    assetFilename: input.assetFilename ?? '',
    durationSec: input.durationSec ?? 0,
  });
  return { id: lesson.id, title: lesson.title, type: lesson.type, preview: lesson.preview, status: lesson.status };
}

export async function updateLesson(creatorId: string, lessonId: string, patch: Record<string, unknown>) {
  const lesson = await CourseLessonModel.findOne({ _id: lessonId, creatorId });
  if (!lesson) throw AppError.notFound('Lesson not found');
  const fields = [
    'title', 'type', 'preview', 'status', 'textContent',
    'videoPublicId', 'videoUrl', 'assetPublicId', 'assetResourceType', 'assetFilename', 'durationSec',
  ] as const;
  for (const f of fields) {
    if (patch[f] !== undefined) (lesson as unknown as Record<string, unknown>)[f] = patch[f];
  }
  await lesson.save();
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    preview: lesson.preview,
    status: lesson.status,
  };
}

export async function reorder(creatorId: string, kind: 'modules' | 'lessons', ids: string[]) {
  const update = (id: string, i: number) =>
    kind === 'modules'
      ? CourseModuleModel.updateOne({ _id: id, creatorId }, { $set: { sortOrder: i } })
      : CourseLessonModel.updateOne({ _id: id, creatorId }, { $set: { sortOrder: i } });
  await Promise.all(ids.map(update));
  return { ok: true };
}

export async function deleteLesson(creatorId: string, lessonId: string) {
  const lesson = await CourseLessonModel.findOne({ _id: lessonId, creatorId }).select('moduleId');
  if (!lesson) throw AppError.notFound('Lesson not found');
  const { moduleId } = lesson;
  await CourseLessonModel.deleteOne({ _id: lessonId, creatorId });
  // Renumber the remaining lessons in the module so sortOrder stays contiguous.
  const remaining = await CourseLessonModel.find({ moduleId }).sort({ sortOrder: 1 }).select('_id');
  await Promise.all(
    remaining.map((l, i) => CourseLessonModel.updateOne({ _id: l._id }, { $set: { sortOrder: i } })),
  );
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
    thumbnailStyle: c.thumbnailStyle,
    thumbnailButtonLabel: c.thumbnailButtonLabel,
  }));
}
