import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { AutoDMRuleModel, type AutoDMRuleDoc } from '../../models/AutoDMRule';
import { AppError } from '../../utils/AppError';

// Mounted at /api/autodm.
export const autodmRouter = Router();
autodmRouter.use(requireAuth);

function publicRule(r: AutoDMRuleDoc) {
  return {
    id: r.id,
    platform: r.platform,
    keyword: r.keyword,
    reply: r.reply,
    linkUrl: r.linkUrl,
    enabled: r.enabled,
    triggeredCount: r.triggeredCount,
    createdAt: r.get('createdAt'),
  };
}

const ruleSchema = z.object({
  platform: z.enum(['instagram', 'tiktok']).default('instagram'),
  keyword: z.string().min(1).max(60),
  reply: z.string().min(1).max(1000),
  linkUrl: z.string().url().optional().or(z.literal('')),
  enabled: z.boolean().optional(),
});

autodmRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rules = await AutoDMRuleModel.find({ creatorId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ rules: rules.map(publicRule) });
  }),
);

autodmRouter.post(
  '/',
  validate({ body: ruleSchema }),
  asyncHandler(async (req, res) => {
    const rule = await AutoDMRuleModel.create({ creatorId: req.user!.id, ...req.body });
    res.status(201).json({ rule: publicRule(rule) });
  }),
);

autodmRouter.patch(
  '/:id',
  validate({ body: ruleSchema.partial() }),
  asyncHandler(async (req, res) => {
    const rule = await AutoDMRuleModel.findOne({ _id: req.params.id, creatorId: req.user!.id });
    if (!rule) throw AppError.notFound('Rule not found');
    Object.assign(rule, req.body);
    await rule.save();
    res.json({ rule: publicRule(rule) });
  }),
);

autodmRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const rule = await AutoDMRuleModel.findOneAndDelete({ _id: req.params.id, creatorId: req.user!.id });
    if (!rule) throw AppError.notFound('Rule not found');
    res.json({ ok: true });
  }),
);
