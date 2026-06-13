import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A post-purchase / post-signup drip automation. Each flow has an ordered set
 * of steps fired N days after the trigger event. Steps are stored inline since
 * a flow rarely exceeds a handful of emails.
 */
const flowStepSchema = new Schema(
  {
    dayOffset: { type: Number, required: true, min: 0, max: 365 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 20000 },
  },
  { _id: true },
);

const emailFlowSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    trigger: { type: String, enum: ['purchase', 'lead', 'booking'], default: 'purchase' },
    enabled: { type: Boolean, default: false },
    steps: { type: [flowStepSchema], default: [] },
  },
  { timestamps: true },
);

export type EmailFlow = InferSchemaType<typeof emailFlowSchema>;
export type EmailFlowDoc = HydratedDocument<EmailFlow>;
export const EmailFlowModel = model('EmailFlow', emailFlowSchema);
