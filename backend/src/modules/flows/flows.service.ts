import { EmailFlowModel } from '../../models/EmailFlow';
import type { ProductDoc } from '../../models/Product';
import { enqueueJob } from '../../lib/jobs';
import { logger } from '../../config/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Fire product-specific post-purchase email steps stored on the product. */
export async function triggerProductEmailFlows(product: ProductDoc, recipientEmail: string): Promise<void> {
  const steps = product.emailFlows.filter((s) => s.enabled);
  for (const step of steps) {
    const runAt = new Date(Date.now() + Math.max(0, step.dayOffset) * DAY_MS);
    await enqueueJob(
      'send_email',
      { to: recipientEmail, template: 'broadcast', data: { subject: step.subject, bodyText: step.body } },
      { runAt },
    );
  }
  if (steps.length) {
    logger.info({ productId: product.id, steps: steps.length, to: recipientEmail }, 'Product email flow triggered');
  }
}
