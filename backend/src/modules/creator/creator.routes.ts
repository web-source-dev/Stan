import { Router } from 'express';
import * as ctrl from './creator.controller';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth';
import {
  checkUsernameSchema,
  onboardingSchema,
  updateProfileSchema,
  updateStorefrontSchema,
} from './creator.validators';

// Authenticated creator self-service routes (mounted at /api/creator).
export const creatorRouter = Router();
creatorRouter.use(requireAuth);

creatorRouter.get(
  '/username-available',
  validate({ query: checkUsernameSchema }),
  asyncHandler(ctrl.checkUsername),
);

creatorRouter.get('/profile', asyncHandler(ctrl.getMyProfile));
creatorRouter.post('/onboarding', validate({ body: onboardingSchema }), asyncHandler(ctrl.completeOnboarding));
creatorRouter.patch('/profile', validate({ body: updateProfileSchema }), asyncHandler(ctrl.updateProfile));

creatorRouter.get('/storefront', asyncHandler(ctrl.getStorefront));
creatorRouter.patch(
  '/storefront',
  validate({ body: updateStorefrontSchema }),
  asyncHandler(ctrl.updateStorefront),
);

// Publishing is gated on a verified email per the PRD.
creatorRouter.post('/publish', requireVerifiedEmail, asyncHandler(ctrl.publish));
creatorRouter.post('/unpublish', asyncHandler(ctrl.unpublish));
