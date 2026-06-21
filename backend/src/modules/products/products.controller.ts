import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './products.service';
import { getEntitlements } from '../subscription/subscription.guard';

/**
 * Backstop for the in-editor feature locks: clear any monetization fields the
 * creator's plan doesn't include, so a locked feature can't be set via the API.
 * Only touches fields actually present on the body (safe for partial updates).
 */
async function stripLockedFields(userId: string, body: Record<string, unknown>): Promise<void> {
  const { features } = await getEntitlements(userId);
  const clear = (key: string, value: unknown) => { if (key in body) body[key] = value; };
  if (!features.pricingTools) {
    clear('discountPriceCents', 0);
    clear('paymentPlanEnabled', false);
    clear('discountCodes', []);
    clear('quantityLimit', 0);
  }
  if (!features.orderBumps) {
    clear('orderBumpEnabled', false);
    clear('orderBumpTitle', '');
    clear('orderBumpDescription', '');
    clear('orderBumpPriceCents', 0);
  }
  if (!features.customFields) clear('customFields', []);
  if (!features.affiliate) clear('affiliateEnabled', false);
}

export async function create(req: Request, res: Response) {
  await stripLockedFields(req.user!.id, req.body as Record<string, unknown>);
  const product = await service.createProduct(req.user!.id, req.body);
  res.status(201).json({ product });
}

export async function list(req: Request, res: Response) {
  const products = await service.listProducts(req.user!.id);
  res.json({ products });
}

export async function getOne(req: Request, res: Response) {
  const product = await service.getProduct(req.user!.id, String(req.params.id));
  res.json({ product });
}

export async function update(req: Request, res: Response) {
  await stripLockedFields(req.user!.id, req.body as Record<string, unknown>);
  const product = await service.updateProduct(req.user!.id, String(req.params.id), req.body);
  res.json({ product });
}

export async function publish(req: Request, res: Response) {
  const product = await service.publishProduct(req.user!.id, String(req.params.id));
  res.json({ product });
}

export async function duplicate(req: Request, res: Response) {
  const product = await service.duplicateProduct(req.user!.id, String(req.params.id));
  res.status(201).json({ product });
}

const statusSchema = z.object({ status: z.enum(['draft', 'archived']) });

export async function setStatus(req: Request, res: Response) {
  const { status } = statusSchema.parse(req.body);
  const product = await service.setProductStatus(req.user!.id, String(req.params.id), status);
  res.json({ product });
}
