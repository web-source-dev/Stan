import type { Request, Response } from 'express';
import * as service from './creator.service';

export async function checkUsername(req: Request, res: Response) {
  const username = String(req.query.username);
  const available = await service.isUsernameAvailable(username, req.user!.id);
  res.json({ username, available, reserved: service.isReserved(username) });
}

export async function getMyProfile(req: Request, res: Response) {
  const profile = await service.getOwnProfile(req.user!.id);
  res.json({ profile });
}

export async function completeOnboarding(req: Request, res: Response) {
  const profile = await service.completeOnboarding(req.user!.id, req.body);
  res.status(201).json({ profile });
}

export async function updateProfile(req: Request, res: Response) {
  const profile = await service.updateProfile(req.user!.id, req.body);
  res.json({ profile });
}

export async function getStorefront(req: Request, res: Response) {
  const config = await service.getStorefrontConfig(req.user!.id);
  res.json({ storefront: config });
}

export async function updateStorefront(req: Request, res: Response) {
  const config = await service.updateStorefrontConfig(req.user!.id, req.body);
  res.json({ storefront: config });
}

export async function publish(req: Request, res: Response) {
  const profile = await service.setPublished(req.user!.id, true);
  res.json({ profile });
}

export async function unpublish(req: Request, res: Response) {
  const profile = await service.setPublished(req.user!.id, false);
  res.json({ profile });
}

export async function getPublicStorefront(req: Request, res: Response) {
  const data = await service.getPublicStorefront(String(req.params.username));
  res.json(data);
}
