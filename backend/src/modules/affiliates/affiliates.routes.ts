import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { AppError } from '../../utils/AppError';
import * as service from './affiliates.service';

export const affiliatesRouter = Router();
affiliatesRouter.use(requireAuth);

/** Commissions earned by promoting other creators' products. */
affiliatesRouter.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    res.json(await service.listAffiliateEarnings(req.user!.id));
  }),
);

/** Affiliate-attributed sales on this creator's products. */
affiliatesRouter.get(
  '/sales',
  asyncHandler(async (req, res) => {
    res.json(await service.listCreatorAffiliateSales(req.user!.id));
  }),
);

/** Published products with affiliate sharing on (for building share links). */
affiliatesRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const profile = await CreatorProfileModel.findOne({ userId: req.user!.id }).select('username');
    res.json({
      username: profile?.username ?? '',
      products: await service.listAffiliateProducts(req.user!.id),
    });
  }),
);

affiliatesRouter.post(
  '/commissions/:id/mark-paid',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    const row = await service.markAffiliateCommissionPaid(req.user!.id, String(req.params.id));
    if (!row) throw AppError.notFound('Commission not found');
    res.json({ ok: true });
  }),
);
