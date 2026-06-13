import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * An Instagram (or other channel) keyword auto-reply rule. When a follower
 * comments/DMs the `keyword`, the `reply` is sent automatically. Delivery is
 * handled by an external integration; this model stores the rule + counters.
 */
const autoDmRuleSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: ['instagram', 'tiktok'], default: 'instagram' },
    keyword: { type: String, required: true, trim: true, maxlength: 60 },
    reply: { type: String, required: true, maxlength: 1000 },
    linkUrl: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    triggeredCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type AutoDMRule = InferSchemaType<typeof autoDmRuleSchema>;
export type AutoDMRuleDoc = HydratedDocument<AutoDMRule>;
export const AutoDMRuleModel = model('AutoDMRule', autoDmRuleSchema);
