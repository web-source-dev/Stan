import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Append-only audit trail for security- and fulfilment-relevant events.
 * `actorId` is who performed the action (a user, or null for system/anonymous);
 * `creatorId` is the tenant the action touched, when applicable.
 */
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: Types.ObjectId, ref: 'User', index: true },
    actorType: { type: String, enum: ['user', 'admin', 'system', 'anonymous'], default: 'system' },
    creatorId: { type: Types.ObjectId, ref: 'User', index: true },
    targetType: { type: String },
    targetId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export type AuditLogDoc = HydratedDocument<AuditLog>;

export const AuditLogModel = model('AuditLog', auditLogSchema);
