import type { Request, Response } from 'express';
import { z } from 'zod';
import { UserModel } from '../../models/User';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { AuditLogModel } from '../../models/AuditLog';
import { JobModel } from '../../models/Job';
import { WebhookEventModel } from '../../models/WebhookEvent';
import { AppError } from '../../utils/AppError';
import { recordAudit, auditContext } from '../../lib/audit';

const listQuery = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function searchCreators(req: Request, res: Response) {
  const { q, limit } = listQuery.parse(req.query);
  const filter = q
    ? { $or: [{ username: new RegExp(q, 'i') }, { displayName: new RegExp(q, 'i') }] }
    : {};
  const profiles = await CreatorProfileModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'email status emailVerified');
  res.json({ creators: profiles });
}

export async function listAuditLogs(req: Request, res: Response) {
  const { limit } = listQuery.parse(req.query);
  const logs = await AuditLogModel.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ logs });
}

export async function systemHealth(_req: Request, res: Response) {
  const [pendingJobs, failedJobs, failedWebhooks] = await Promise.all([
    JobModel.countDocuments({ status: 'pending' }),
    JobModel.countDocuments({ status: 'failed' }),
    WebhookEventModel.countDocuments({ status: 'failed' }),
  ]);
  res.json({ jobs: { pending: pendingJobs, failed: failedJobs }, webhooks: { failed: failedWebhooks } });
}

const suspendSchema = z.object({ status: z.enum(['active', 'suspended', 'deactivated']) });

export async function setUserStatus(req: Request, res: Response) {
  const { status } = suspendSchema.parse(req.body);
  const user = await UserModel.findById(req.params.userId);
  if (!user) throw AppError.notFound('User not found');
  user.status = status;
  if (status !== 'active') user.tokenVersion += 1; // force logout everywhere
  await user.save();
  recordAudit({
    action: 'admin.user_status_changed',
    actorId: req.user!.id,
    actorType: 'admin',
    creatorId: user.id,
    targetType: 'user',
    targetId: user.id,
    metadata: { status },
    ...auditContext(req),
  });
  res.json({ user: { id: user.id, status: user.status } });
}

export async function unpublishCreator(req: Request, res: Response) {
  const profile = await CreatorProfileModel.findById(req.params.profileId);
  if (!profile) throw AppError.notFound('Profile not found');
  profile.published = false;
  await profile.save();
  recordAudit({
    action: 'admin.creator_unpublished',
    actorId: req.user!.id,
    actorType: 'admin',
    creatorId: String(profile.userId),
    targetType: 'creator_profile',
    targetId: profile.id,
    ...auditContext(req),
  });
  res.json({ profile: { id: profile.id, published: profile.published } });
}
