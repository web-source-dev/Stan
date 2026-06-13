import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog';
import { logger } from '../config/logger';

interface AuditInput {
  action: string;
  actorId?: string | Types.ObjectId | null;
  actorType?: 'user' | 'admin' | 'system' | 'anonymous';
  creatorId?: string | Types.ObjectId | null;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit record. Fire-and-forget: auditing must never break the
 * request it is recording, so failures are logged but not thrown.
 */
export function recordAudit(input: AuditInput): void {
  AuditLogModel.create({
    action: input.action,
    actorId: input.actorId ?? undefined,
    actorType: input.actorType ?? 'system',
    creatorId: input.creatorId ?? undefined,
    targetType: input.targetType,
    targetId: input.targetId,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: input.metadata ?? {},
  }).catch((err) => logger.error({ err, action: input.action }, 'Failed to write audit log'));
}

/** Extract client metadata from a request for audit context. */
export function auditContext(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}
