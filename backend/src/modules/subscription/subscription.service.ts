import { SubscriptionModel, PLANS, normalizePlan, type PlanKey } from '../../models/Subscription';
import { InvoiceModel } from '../../models/Invoice';
import { accrueCommissionForUser } from '../referrals/referrals.service';
import { logger } from '../../config/logger';

/** Next sequential invoice number for a user, e.g. INV-2026-0003. */
export async function nextInvoiceNumber(userId: string): Promise<string> {
  const count = await InvoiceModel.countDocuments({ userId });
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Record a paid subscription invoice and credit referral commission on every
 * charge (initial purchase and renewals).
 */
export async function createSubscriptionInvoice(
  userId: string,
  planKey: PlanKey,
  periodEnd?: Date | null,
) {
  const plan = PLANS[planKey];
  if (plan.cents <= 0) return null;
  const months = plan.interval === 'year' ? 12 : 1;
  const periodStart = new Date();
  const inv = await InvoiceModel.create({
    userId,
    number: await nextInvoiceNumber(userId),
    kind: 'subscription',
    description: `${plan.label} plan — ${plan.interval === 'year' ? 'Yearly' : 'Monthly'}`,
    planKey,
    interval: plan.interval,
    amountCents: plan.cents,
    currency: 'usd',
    status: 'paid',
    periodStart,
    periodEnd: periodEnd ?? new Date(periodStart.getTime() + months * 30 * 24 * 60 * 60 * 1000),
    paidAt: periodStart,
  });
  await accrueCommissionForUser(userId, plan.cents);
  return inv;
}

let renewalTimer: NodeJS.Timeout | null = null;

/**
 * Renew active paid subscriptions whose billing period has ended, issue an
 * invoice, and accrue referral commission (lifetime revenue share).
 */
export async function processSubscriptionRenewals(): Promise<number> {
  const now = new Date();
  const subs = await SubscriptionModel.find({
    status: 'active',
    cancelAtPeriodEnd: { $ne: true },
    currentPeriodEnd: { $lte: now },
  });
  let renewed = 0;
  for (const sub of subs) {
    const planKey = normalizePlan(sub.plan);
    if (PLANS[planKey].cents <= 0) continue;
    const months = PLANS[planKey].interval === 'year' ? 12 : 1;
    sub.currentPeriodEnd = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    await sub.save();
    await createSubscriptionInvoice(String(sub.userId), planKey, sub.currentPeriodEnd).catch(() => null);
    renewed += 1;
  }
  if (renewed > 0) logger.info({ renewed }, 'Subscription renewals processed');
  return renewed;
}

export function startSubscriptionMaintenance(): void {
  if (renewalTimer) return;
  void processSubscriptionRenewals().catch(() => undefined);
  renewalTimer = setInterval(() => void processSubscriptionRenewals().catch(() => undefined), 60 * 60 * 1000);
}

export function stopSubscriptionMaintenance(): void {
  if (renewalTimer) {
    clearInterval(renewalTimer);
    renewalTimer = null;
  }
}
