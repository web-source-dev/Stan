import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { signUploadHandler } from './cloudinary.controller';

// Mounted at /api/cloudinary.
export const cloudinaryRouter = Router();
cloudinaryRouter.use(requireAuth);

cloudinaryRouter.post('/sign-upload', asyncHandler(signUploadHandler));
