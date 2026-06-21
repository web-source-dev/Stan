import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { publicWriteLimiter } from '../../middleware/rateLimit';
import {
  getAccessMeta,
  requestAccessCode,
  verifyAccessCode,
  getAccessFiles,
  mintPreviewUrl,
  mintDownloadUrl,
} from './access.service';

/**
 * Email-gated buyer fulfilment access.
 *
 * The emailed accessToken identifies the purchase but is no longer enough to
 * open it: the visitor must enter a one-time code sent to the buyer's email,
 * which mints a short-lived buyer session. That session is required to list
 * files and mint signed download URLs — so a forwarded/leaked link can't be
 * opened by anyone other than the purchaser.
 */
export const fulfilmentRouter = Router();

const tokenParam = z.object({ token: z.string().min(20).max(200) });
const emailBody = z.string().email().max(200);

// Pre-verification: product summary + a masked email hint. No files, no URLs.
fulfilmentRouter.get(
  '/:token',
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    res.json(await getAccessMeta(String(req.params.token)));
  }),
);

// Email a one-time access code (only actually sent if the email matches).
fulfilmentRouter.post(
  '/:token/request-code',
  publicWriteLimiter,
  validate({ params: tokenParam, body: z.object({ email: emailBody }) }),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    res.json(await requestAccessCode(String(req.params.token), email));
  }),
);

// Verify the code → buyer session + product + file list.
fulfilmentRouter.post(
  '/:token/verify',
  publicWriteLimiter,
  validate({ params: tokenParam, body: z.object({ email: emailBody, code: z.string().min(4).max(10) }) }),
  asyncHandler(async (req, res) => {
    const { email, code } = req.body as { email: string; code: string };
    res.json(await verifyAccessCode(String(req.params.token), email, code));
  }),
);

// Returning buyer with a valid session: re-list files (Authorization: Bearer).
fulfilmentRouter.get(
  '/:token/files',
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    res.json(await getAccessFiles(String(req.params.token), req.headers.authorization));
  }),
);

// Mint a short-lived signed URL to PREVIEW one file inline (always allowed).
fulfilmentRouter.post(
  '/:token/preview/:fileId',
  publicWriteLimiter,
  validate({ params: tokenParam.extend({ fileId: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    const { url } = await mintPreviewUrl(
      String(req.params.token),
      req.headers.authorization,
      String(req.params.fileId),
    );
    res.json({ url });
  }),
);

// Mint a short-lived signed download URL — only if the creator enabled downloads.
fulfilmentRouter.post(
  '/:token/download/:fileId',
  publicWriteLimiter,
  validate({ params: tokenParam.extend({ fileId: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    const { url } = await mintDownloadUrl(
      String(req.params.token),
      req.headers.authorization,
      String(req.params.fileId),
    );
    res.json({ url });
  }),
);
