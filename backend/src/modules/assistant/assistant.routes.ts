import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireFeature } from '../subscription/subscription.guard';
import { env } from '../../config/env';
import { chat, setupChecklist } from './assistant.service';

// Mounted at /api/assistant.
export const assistantRouter = Router();
assistantRouter.use(requireAuth);
assistantRouter.use(requireFeature('stanleyAI'));

assistantRouter.get('/status', asyncHandler(async (_req, res) => {
  res.json({ aiConfigured: env.aiConfigured });
}));

assistantRouter.get('/setup', asyncHandler(async (req, res) => {
  res.json(await setupChecklist(req.user!.id));
}));

assistantRouter.post(
  '/chat',
  validate({
    body: z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      })).min(1).max(40),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await chat(req.user!.id, req.body.messages);
    res.json(result);
  }),
);
