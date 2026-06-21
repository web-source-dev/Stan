import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * An Instagram (or other channel) keyword auto-reply rule. When a follower
 * comments/DMs the `keyword`, the `reply` is sent automatically. Delivery is
 * handled by an external integration; this model stores the rule + counters.
 *
 * Comment automation: `mediaId` optionally scopes a rule to a single post (empty
 * = any post). When `dmOnComment` is set, a matching comment triggers a private
 * DM to the commenter (carrying `reply` + `linkUrl`) plus an optional public
 * comment reply (`publicReply`, e.g. "Just sent you a DM! 📩").
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

    // Comment-automation scope + behaviour.
    mediaId: { type: String, default: '' }, // scope comment matching to one post; '' = all posts
    mediaPermalink: { type: String, default: '' }, // for display in the dashboard
    mediaThumbnail: { type: String, default: '' },
    mediaCaption: { type: String, default: '' },
    dmOnComment: { type: Boolean, default: true }, // also DM the commenter when a comment matches
    publicReply: { type: String, default: '' }, // optional public reply posted under the comment
  },
  { timestamps: true },
);

export type AutoDMRule = InferSchemaType<typeof autoDmRuleSchema>;
export type AutoDMRuleDoc = HydratedDocument<AutoDMRule>;
export const AutoDMRuleModel = model('AutoDMRule', autoDmRuleSchema);
