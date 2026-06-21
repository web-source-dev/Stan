import { Router } from 'express';
import * as ctrl from './products.controller';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { getEntitlements } from '../subscription/subscription.guard';
import { ProductModel } from '../../models/Product';
import { AppError } from '../../utils/AppError';
import { createProductSchema, updateProductSchema, idParam } from './products.validators';

// Authenticated creator product management (mounted at /api/products).
export const productsRouter = Router();
productsRouter.use(requireAuth);

/** Block creating a new product once the plan's product limit is reached. */
const enforceProductLimit = asyncHandler(async (req, _res, next) => {
  const { tier, features } = await getEntitlements(req.user!.id);
  if (features.maxProducts !== null) {
    const count = await ProductModel.countDocuments({ creatorId: req.user!.id });
    if (count >= features.maxProducts) {
      throw new AppError(
        403,
        'upgrade_required',
        `Your plan is limited to ${features.maxProducts} product${features.maxProducts === 1 ? '' : 's'}. Upgrade to add more.`,
        { feature: 'maxProducts', tier, limit: features.maxProducts },
      );
    }
  }
  next();
});

productsRouter.get('/', asyncHandler(ctrl.list));
productsRouter.post('/', enforceProductLimit, validate({ body: createProductSchema }), asyncHandler(ctrl.create));
productsRouter.get('/:id', validate({ params: idParam }), asyncHandler(ctrl.getOne));
productsRouter.patch('/:id', validate({ params: idParam, body: updateProductSchema }), asyncHandler(ctrl.update));
productsRouter.post('/:id/publish', validate({ params: idParam }), asyncHandler(ctrl.publish));
productsRouter.post('/:id/duplicate', enforceProductLimit, validate({ params: idParam }), asyncHandler(ctrl.duplicate));
productsRouter.post('/:id/status', validate({ params: idParam }), asyncHandler(ctrl.setStatus));
