import { Router } from 'express';
import * as ctrl from './admin.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';

// Platform-admin only (mounted at /api/admin).
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/creators', asyncHandler(ctrl.searchCreators));
adminRouter.get('/audit-logs', asyncHandler(ctrl.listAuditLogs));
adminRouter.get('/health', asyncHandler(ctrl.systemHealth));
adminRouter.patch('/users/:userId/status', asyncHandler(ctrl.setUserStatus));
adminRouter.post('/creators/:profileId/unpublish', asyncHandler(ctrl.unpublishCreator));
