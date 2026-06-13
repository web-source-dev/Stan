import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { usernameParam } from '../creator/creator.validators';
import { getPublicStorefront } from '../creator/creator.controller';
import { getPublicProductByUsername } from '../products/products.service';
import { getPublicCourse } from '../courses/courses.service';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { LandingPageModel } from '../../models/LandingPage';
import { ProductModel } from '../../models/Product';
import { AppError } from '../../utils/AppError';

// Public, unauthenticated storefront read (mounted at /api/storefront).
export const storefrontRouter = Router();

storefrontRouter.get(
  '/:username',
  validate({ params: usernameParam }),
  asyncHandler(getPublicStorefront),
);

const productParams = usernameParam.extend({ slug: z.string().min(1).max(80) });

storefrontRouter.get(
  '/:username/products/:slug',
  validate({ params: productParams }),
  asyncHandler(async (req, res) => {
    const product = await getPublicProductByUsername(String(req.params.username), String(req.params.slug));
    res.json({ product });
  }),
);

storefrontRouter.get(
  '/:username/courses/:slug',
  validate({ params: productParams }),
  asyncHandler(async (req, res) => {
    const data = await getPublicCourse(String(req.params.username), String(req.params.slug));
    res.json(data);
  }),
);

// Public read of a published private landing page.
storefrontRouter.get(
  '/:username/landing/:slug',
  validate({ params: productParams }),
  asyncHandler(async (req, res) => {
    const profile = await CreatorProfileModel.findOne({ username: String(req.params.username) }).select('userId published displayName avatarUrl');
    if (!profile || !profile.published) throw AppError.notFound('Page not found');
    const page = await LandingPageModel.findOneAndUpdate(
      { creatorId: profile.userId, slug: String(req.params.slug), published: true },
      { $inc: { views: 1 } },
      { new: true },
    );
    if (!page) throw AppError.notFound('Page not found');

    // Resolve the linked offer (if any) so the page can drive a purchase.
    let product = null;
    if (page.productId) {
      const p = await ProductModel.findOne({ _id: page.productId, creatorId: profile.userId, status: 'published' });
      if (p) product = { title: p.title, slug: p.slug, priceCents: p.priceCents, currency: p.currency, coverImageUrl: p.coverImageUrl, shortDescription: p.shortDescription };
    }

    res.json({
      page: { title: page.title, headline: page.headline, body: page.body, ctaLabel: page.ctaLabel },
      product,
      creator: { displayName: profile.displayName, avatarUrl: profile.avatarUrl, username: String(req.params.username) },
    });
  }),
);
