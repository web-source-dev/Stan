import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireFeature } from '../subscription/subscription.guard';
import { AutoDMRuleModel, type AutoDMRuleDoc } from '../../models/AutoDMRule';
import { AppError } from '../../utils/AppError';
import { runAutoReply, fetchAccountMedia } from '../integrations/instagram.service';

// Mounted at /api/autodm.
export const autodmRouter = Router();
autodmRouter.use(requireAuth);
autodmRouter.use(requireFeature('autodm'));

function publicRule(r: AutoDMRuleDoc) {
  return {
    id: r.id,
    platform: r.platform,
    keyword: r.keyword,
    reply: r.reply,
    linkUrl: r.linkUrl,
    enabled: r.enabled,
    triggeredCount: r.triggeredCount,
    mediaId: r.mediaId,
    mediaPermalink: r.mediaPermalink,
    mediaThumbnail: r.mediaThumbnail,
    mediaCaption: r.mediaCaption,
    dmOnComment: r.dmOnComment,
    publicReply: r.publicReply,
    createdAt: r.get('createdAt'),
  };
}

const ruleSchema = z.object({
  platform: z.enum(['instagram', 'tiktok']).default('instagram'),
  keyword: z.string().min(1).max(60),
  reply: z.string().min(1).max(1000),
  linkUrl: z.string().url().optional().or(z.literal('')),
  enabled: z.boolean().optional(),
  // Comment-automation: optionally scope to one post + comment→DM behaviour.
  mediaId: z.string().max(64).optional().or(z.literal('')),
  mediaPermalink: z.string().max(500).optional().or(z.literal('')),
  mediaThumbnail: z.string().max(1000).optional().or(z.literal('')),
  mediaCaption: z.string().max(2200).optional().or(z.literal('')),
  dmOnComment: z.boolean().optional(),
  publicReply: z.string().max(1000).optional().or(z.literal('')),
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

// Recent posts from the connected Instagram account, for scoping a comment rule
// to a specific post. Returns [] when not connected so the UI degrades cleanly.
autodmRouter.get(
  '/instagram/media',
  asyncHandler(async (req, res) => {
    const media = await fetchAccountMedia(req.user!.id);
    res.json({ media });
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

// Run the auto-reply engine against a sample message. Lets a creator verify a
// rule end-to-end (keyword match → reply + triggeredCount) without waiting for a
// real comment/DM. Delivery is simulated (logged), never sent to a live account.
const simulateSchema = z.object({
  platform: z.enum(['instagram', 'tiktok']).default('instagram'),
  text: z.string().min(1).max(1000),
});
autodmRouter.post(
  '/simulate',
  validate({ body: simulateSchema }),
  asyncHandler(async (req, res) => {
    const result = await runAutoReply({
      creatorId: req.user!.id,
      platform: req.body.platform,
      text: req.body.text,
      source: 'simulation',
    });
    res.json({ result });
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
