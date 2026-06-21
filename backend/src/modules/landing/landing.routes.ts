import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireFeature } from '../subscription/subscription.guard';
import { LandingPageModel, type LandingPageDoc } from '../../models/LandingPage';
import { AppError } from '../../utils/AppError';

// Mounted at /api/landing.
export const landingRouter = Router();
landingRouter.use(requireAuth);
landingRouter.use(requireFeature('landingPages'));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
}

function publicPage(p: LandingPageDoc) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    headline: p.headline,
    body: p.body,
    productId: p.productId ? String(p.productId) : null,
    ctaLabel: p.ctaLabel,
    published: p.published,
    views: p.views,
    createdAt: p.get('createdAt'),
  };
}

const pageSchema = z.object({
  title: z.string().min(1).max(160),
  headline: z.string().max(200).optional(),
  body: z.string().max(10000).optional(),
  productId: z.string().regex(/^[a-f0-9]{24}$/).optional().nullable(),
  ctaLabel: z.string().max(60).optional(),
  published: z.boolean().optional(),
});

landingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const pages = await LandingPageModel.find({ creatorId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ pages: pages.map(publicPage) });
  }),
);

landingRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const page = await LandingPageModel.findOne({ _id: req.params.id, creatorId: req.user!.id });
    if (!page) throw AppError.notFound('Landing page not found');
    res.json({ page: publicPage(page) });
  }),
);

landingRouter.post(
  '/',
  validate({ body: pageSchema }),
  asyncHandler(async (req, res) => {
    const creatorId = req.user!.id;
    let slug = slugify(req.body.title);
    // Ensure slug is unique per creator.
    let n = 1;
    while (await LandingPageModel.exists({ creatorId, slug })) slug = `${slugify(req.body.title)}-${++n}`;
    const page = await LandingPageModel.create({ creatorId, ...req.body, slug });
    res.status(201).json({ page: publicPage(page) });
  }),
);

landingRouter.patch(
  '/:id',
  validate({ body: pageSchema.partial() }),
  asyncHandler(async (req, res) => {
    const page = await LandingPageModel.findOne({ _id: req.params.id, creatorId: req.user!.id });
    if (!page) throw AppError.notFound('Landing page not found');
    const { productId, ...rest } = req.body;
    Object.assign(page, rest);
    if (productId === null || productId === '') page.productId = undefined;
    else if (productId) page.productId = productId;
    await page.save();
    res.json({ page: publicPage(page) });
  }),
);

landingRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const page = await LandingPageModel.findOneAndDelete({ _id: req.params.id, creatorId: req.user!.id });
    if (!page) throw AppError.notFound('Landing page not found');
    res.json({ ok: true });
  }),
);
