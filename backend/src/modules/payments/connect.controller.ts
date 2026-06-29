import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/AppError';
import * as connect from './connect.service';

const onboardBody = z.object({ returnBase: z.string().url().max(200).optional() });

export async function onboard(req: Request, res: Response) {
  const parsed = onboardBody.safeParse(req.body ?? {});
  const returnBase = parsed.success ? parsed.data.returnBase : undefined;
  const { url } = await connect.createOnboardingLink(req.user!.id, returnBase);
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

/* ---- PayPal ---- */

export async function paypalStatus(req: Request, res: Response) {
  res.json({ paypal: await connect.getPayPalStatus(req.user!.id) });
}

const paypalConnectBody = z.object({ email: z.string().email().max(200) });

export async function paypalConnect(req: Request, res: Response) {
  const parsed = paypalConnectBody.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Enter a valid PayPal email address');
  const result = await connect.setPayPalEmail(req.user!.id, parsed.data.email);
  res.json({ paypalEmail: result.paypalEmail });
}

export async function paypalDisconnect(req: Request, res: Response) {
  await connect.setPayPalEmail(req.user!.id, '');
  res.json({ paypalEmail: '' });
}
