import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import { AppError } from '../../utils/AppError';
import { EntitlementModel } from '../../models/Entitlement';
import { ProductModel } from '../../models/Product';
import { env } from '../../config/env';
import { signedDeliveryUrl } from '../../lib/cloudinary';

/**
 * Public buyer fulfilment access. The opaque accessToken (emailed to the buyer)
 * backs the download page — buyers are not authenticated accounts. The token
 * resolves to an entitlement; downloads return short-lived signed Cloudinary
 * URLs generated on demand, so links in the page can't be shared long-term.
 */
export const fulfilmentRouter = Router();

const tokenParam = z.object({ token: z.string().min(20).max(200) });

async function resolveEntitlement(token: string) {
  const entitlement = await EntitlementModel.findOne({ accessToken: token });
  if (!entitlement || entitlement.revokedAt) throw AppError.notFound('Access not found or revoked');
  const product = await ProductModel.findById(entitlement.productId);
  if (!product) throw AppError.notFound('Product no longer available');
  return { entitlement, product };
}

// Fulfilment page data: product info + file list (no direct URLs yet).
fulfilmentRouter.get(
  '/:token',
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    const { entitlement, product } = await resolveEntitlement(String(req.params.token));
    entitlement.lastAccessedAt = new Date();
    await entitlement.save();
    res.json({
      product: {
        title: product.title,
        shortDescription: product.shortDescription,
        thankYouMessage: product.thankYouMessage,
        coverImageUrl: product.coverImageUrl,
      },
      files: product.assets.map((a) => ({
        id: String(a._id),
        filename: a.filename,
        bytes: a.bytes,
      })),
    });
  }),
);

// Mint a short-lived signed download URL for one file, then redirect to it.
fulfilmentRouter.get(
  '/:token/download/:fileId',
  publicWriteLimiter,
  validate({ params: tokenParam.extend({ fileId: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    if (!env.cloudinaryConfigured) {
      throw new AppError(503, 'cloudinary_unconfigured', 'Downloads are not configured');
    }
    const { entitlement, product } = await resolveEntitlement(String(req.params.token));
    const asset = product.assets.find((a) => String(a._id) === req.params.fileId);
    if (!asset) throw AppError.notFound('File not found');

    const url = signedDeliveryUrl(asset.publicId, asset.resourceType, 300);
    entitlement.downloadCount += 1;
    entitlement.lastAccessedAt = new Date();
    await entitlement.save();
    res.redirect(302, url);
  }),
);
