import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { signUpload } from '../../lib/cloudinary';

const signSchema = z.object({
  // Logical purpose of the upload; determines folder + constraints.
  kind: z.enum(['avatar', 'product_cover', 'product_file', 'course_cover', 'course_video', 'og_image']),
});

const FOLDERS: Record<string, (creatorId: string) => string> = {
  avatar: (id) => `creators/${id}/profile`,
  product_cover: (id) => `creators/${id}/products/covers`,
  product_file: (id) => `creators/${id}/products/files`,
  course_cover: (id) => `creators/${id}/courses/covers`,
  course_video: (id) => `creators/${id}/courses/videos`,
  og_image: (id) => `creators/${id}/og`,
};

/**
 * Return a short-lived signature so the authenticated creator can upload
 * directly to Cloudinary. The folder is bound to the creator's tenant, so a
 * creator cannot write into another creator's namespace.
 */
export async function signUploadHandler(req: Request, res: Response) {
  if (!env.cloudinaryConfigured) {
    throw new AppError(503, 'cloudinary_unconfigured', 'Media uploads are not configured');
  }
  const { kind } = signSchema.parse(req.body);
  const folder = FOLDERS[kind](req.user!.id);

  const { signature, timestamp } = signUpload({ folder });

  res.json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
  });
}
