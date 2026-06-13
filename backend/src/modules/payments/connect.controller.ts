import type { Request, Response } from 'express';
import * as connect from './connect.service';

export async function onboard(req: Request, res: Response) {
  const { url } = await connect.createOnboardingLink(req.user!.id);
  res.json({ url });
}

export async function status(req: Request, res: Response) {
  // ?refresh=1 pulls live state from Stripe; default returns the cached mirror.
  const data =
    req.query.refresh === '1'
      ? await connect.refreshStatus(req.user!.id)
      : await connect.getStatus(req.user!.id);
  res.json({ account: data });
}
