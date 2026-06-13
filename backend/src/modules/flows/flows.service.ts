import { EmailFlowModel } from '../../models/EmailFlow';
import { enqueueJob } from '../../lib/jobs';
import { logger } from '../../config/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fire any enabled email flows for a creator that match the given trigger.
 * Each step is enqueued as a durable `send_email` job; `dayOffset > 0` steps are
 * scheduled into the future via the job runner's `runAt`, so a flow becomes a
 * real post-purchase / post-signup drip. Emails deliver via Resend when
 * configured, and are logged in dev — same as every other transactional email.
 */
export async function triggerFlows(
  creatorId: string,
  recipientEmail: string,
  trigger: 'purchase' | 'lead' | 'booking',
): Promise<void> {
  const flows = await EmailFlowModel.find({ creatorId, trigger, enabled: true });
  for (const flow of flows) {
    for (const step of flow.steps) {
      const runAt = new Date(Date.now() + Math.max(0, step.dayOffset) * DAY_MS);
      await enqueueJob(
        'send_email',
        { to: recipientEmail, template: 'broadcast', data: { subject: step.subject, bodyText: step.body } },
        { runAt },
      );
    }
    if (flow.steps.length) {
      logger.info({ flowId: flow.id, trigger, steps: flow.steps.length, to: recipientEmail }, 'Email flow triggered');
    }
  }
}
