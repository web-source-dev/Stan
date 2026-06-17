import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './courses.service';

const id = z.string().regex(/^[a-f0-9]{24}$/);
const idParam = z.object({ id });

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

const courseBody = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  shortDescription: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().min(0).max(100_000_00).optional(),
  coverImageUrl: z.string().max(2000).optional(),
  coverPublicId: z.string().max(300).optional(),
  discountPriceCents: z.number().int().min(0).optional(),
  discountEnabled: z.boolean().optional(),
  billingInterval: z.enum(['one_time', 'month', 'year']).optional(),
  thumbnailStyle: z.enum(['button', 'callout', 'preview']).optional(),
  thumbnailButtonLabel: z.string().max(80).optional(),
  bottomTitle: z.string().max(140).optional(),
  ctaLabel: z.string().max(80).optional(),
  homepageTitle: z.string().max(140).optional(),
  homepageDescription: z.string().max(5000).optional(),
  homepageCoverImageUrl: z.string().max(2000).optional(),
  homepageCoverPublicId: z.string().max(300).optional(),
  titleFont: z.string().max(80).optional(),
  backgroundColor: z.string().max(20).optional(),
  highlightColor: z.string().max(20).optional(),
  confirmSubject: z.string().max(200).optional(),
  confirmBody: z.string().max(5000).optional(),
});

const lessonBody = z.object({
  moduleId: id.optional(),
  title: z.string().min(1).max(200).optional(),
  type: z.enum(['video', 'text', 'download']).optional(),
  preview: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
  textContent: z.string().max(20000).optional(),
  videoPublicId: z.string().max(300).optional(),
  videoUrl: z.string().max(2000).optional(),
  assetPublicId: z.string().max(300).optional(),
  assetResourceType: z.enum(['raw', 'video', 'image']).optional(),
  assetFilename: z.string().max(300).optional(),
  durationSec: z.number().int().min(0).optional(),
});

coursesRouter.get('/', asyncHandler(async (req, res) => res.json({ courses: await service.listCourses(req.user!.id) })));
coursesRouter.post('/', validate({ body: courseBody }), asyncHandler(async (req, res) => res.status(201).json({ course: await service.createCourse(req.user!.id, req.body) })));
coursesRouter.get('/lessons/:id', validate({ params: idParam }), asyncHandler(async (req, res) => res.json(await service.getLesson(req.user!.id, String(req.params.id)))));
coursesRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => res.json(await service.getCourseTree(req.user!.id, String(req.params.id)))));
coursesRouter.patch('/:id', validate({ params: idParam, body: courseBody.partial() }), asyncHandler(async (req, res) => res.json({ course: await service.updateCourse(req.user!.id, String(req.params.id), req.body) })));
coursesRouter.post('/:id/publish', validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ course: await service.publishCourse(req.user!.id, String(req.params.id)) })));
coursesRouter.post('/:id/status', validate({ params: idParam, body: z.object({ status: z.enum(['draft', 'archived']) }) }), asyncHandler(async (req, res) => res.json({ course: await service.setCourseStatus(req.user!.id, String(req.params.id), req.body.status) })));

coursesRouter.post('/:id/modules', validate({ params: idParam, body: z.object({ title: z.string().min(1).max(140) }) }), asyncHandler(async (req, res) => res.status(201).json({ module: await service.addModule(req.user!.id, String(req.params.id), req.body.title) })));
coursesRouter.patch('/modules/:id', validate({ params: idParam, body: z.object({ title: z.string().min(1).max(140).optional(), status: z.enum(['draft', 'published']).optional() }) }), asyncHandler(async (req, res) => res.json({ module: await service.updateModule(req.user!.id, String(req.params.id), req.body) })));

coursesRouter.post('/:id/lessons', validate({ params: idParam, body: lessonBody.extend({ moduleId: id, title: z.string().min(1).max(200) }) }), asyncHandler(async (req, res) => {
  const { moduleId, ...rest } = req.body;
  res.status(201).json({ lesson: await service.addLesson(req.user!.id, String(req.params.id), moduleId, rest) });
}));
coursesRouter.patch('/lessons/:id', validate({ params: idParam, body: lessonBody.partial() }), asyncHandler(async (req, res) => res.json({ lesson: await service.updateLesson(req.user!.id, String(req.params.id), req.body) })));
coursesRouter.delete('/lessons/:id', validate({ params: idParam }), asyncHandler(async (req, res) => res.json(await service.deleteLesson(req.user!.id, String(req.params.id)))));
coursesRouter.post('/reorder', validate({ body: z.object({ kind: z.enum(['modules', 'lessons']), ids: z.array(id).max(200) }) }), asyncHandler(async (req, res) => res.json(await service.reorder(req.user!.id, req.body.kind, req.body.ids))));
