import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './products.service';

export async function create(req: Request, res: Response) {
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
