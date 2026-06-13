import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { EmailFlowModel, type EmailFlowDoc } from '../../models/EmailFlow';
import { AppError } from '../../utils/AppError';

// Mounted at /api/flows.
export const flowsRouter = Router();
flowsRouter.use(requireAuth);

function publicFlow(f: EmailFlowDoc) {
  return {
    id: f.id,
    name: f.name,
    trigger: f.trigger,
    enabled: f.enabled,
    steps: f.steps.map((s) => ({ id: String(s._id), dayOffset: s.dayOffset, subject: s.subject, body: s.body })),
    createdAt: f.get('createdAt'),
  };
}

const stepSchema = z.object({
  dayOffset: z.number().int().min(0).max(365),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

const flowSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: z.enum(['purchase', 'lead', 'booking']).default('purchase'),
  enabled: z.boolean().optional(),
  steps: z.array(stepSchema).max(20).default([]),
});

flowsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const flows = await EmailFlowModel.find({ creatorId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ flows: flows.map(publicFlow) });
  }),
);

flowsRouter.post(
  '/',
  validate({ body: flowSchema }),
  asyncHandler(async (req, res) => {
    const flow = await EmailFlowModel.create({ creatorId: req.user!.id, ...req.body });
    res.status(201).json({ flow: publicFlow(flow) });
  }),
);

flowsRouter.patch(
  '/:id',
  validate({ body: flowSchema.partial() }),
  asyncHandler(async (req, res) => {
    const flow = await EmailFlowModel.findOne({ _id: req.params.id, creatorId: req.user!.id });
    if (!flow) throw AppError.notFound('Flow not found');
    Object.assign(flow, req.body);
    await flow.save();
    res.json({ flow: publicFlow(flow) });
  }),
);

flowsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const flow = await EmailFlowModel.findOneAndDelete({ _id: req.params.id, creatorId: req.user!.id });
    if (!flow) throw AppError.notFound('Flow not found');
    res.json({ ok: true });
  }),
);
