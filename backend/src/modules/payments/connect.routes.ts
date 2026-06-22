import { Router } from 'express';
import * as ctrl from './connect.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';

// Mounted at /api/payments/connect.
export const connectRouter = Router();
connectRouter.use(requireAuth);

connectRouter.post('/onboard', asyncHandler(ctrl.onboard));
connectRouter.get('/status', asyncHandler(ctrl.status));

// PayPal connect (payee email).
connectRouter.get('/paypal/status', asyncHandler(ctrl.paypalStatus));
connectRouter.post('/paypal/connect', asyncHandler(ctrl.paypalConnect));
connectRouter.post('/paypal/disconnect', asyncHandler(ctrl.paypalDisconnect));
