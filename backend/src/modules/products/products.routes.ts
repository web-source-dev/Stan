import { Router } from 'express';
import * as ctrl from './products.controller';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { createProductSchema, updateProductSchema, idParam } from './products.validators';

// Authenticated creator product management (mounted at /api/products).
export const productsRouter = Router();
productsRouter.use(requireAuth);

productsRouter.get('/', asyncHandler(ctrl.list));
productsRouter.post('/', validate({ body: createProductSchema }), asyncHandler(ctrl.create));
productsRouter.get('/:id', validate({ params: idParam }), asyncHandler(ctrl.getOne));
productsRouter.patch('/:id', validate({ params: idParam, body: updateProductSchema }), asyncHandler(ctrl.update));
productsRouter.post('/:id/publish', validate({ params: idParam }), asyncHandler(ctrl.publish));
productsRouter.post('/:id/duplicate', validate({ params: idParam }), asyncHandler(ctrl.duplicate));
productsRouter.post('/:id/status', validate({ params: idParam }), asyncHandler(ctrl.setStatus));
