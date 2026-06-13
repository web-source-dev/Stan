import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const SEGMENTS = ['all_leads', 'customers', 'subscribers'] as const;
export type Segment = (typeof SEGMENTS)[number];

/**
 * A one-off email broadcast to a derived segment. Sending enqueues per-recipient
 * send_email jobs (durable + retried); the broadcast row records intent and a
 * delivery tally.
 */
const broadcastSchema = new Schema(
  {
    creatorId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, required: true },
    segment: { type: String, enum: SEGMENTS, default: 'all_leads' },

    status: { type: String, enum: ['draft', 'sending', 'sent'], default: 'draft' },
    recipientCount: { type: Number, default: 0 },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

export type Broadcast = InferSchemaType<typeof broadcastSchema>;
export type BroadcastDoc = HydratedDocument<Broadcast>;

export const BroadcastModel = model('Broadcast', broadcastSchema);
