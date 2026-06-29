import type Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { OrderModel } from '../../models/Order';
import { EntitlementModel } from '../../models/Entitlement';
import { ProductModel, type ProductDoc } from '../../models/Product';
import { BuyerMembershipModel } from '../../models/BuyerMembership';
import { UserModel } from '../../models/User';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import { upsertCustomerLead } from '../leads/leads.service';
import { triggerFlows, triggerProductEmailFlows } from '../flows/flows.service';
import { notifyCreatorIfEnabled, notifyCreatorNewSale, resolveCreatorBranding } from '../../lib/creatorNotifications';
import { isNotificationPrefEnabled } from '../../lib/notificationPrefs';
import { membershipBillingInterval, paymentPlanInstallmentCents } from './checkout-pricing';
import { affiliateFieldsForOrder, recordAffiliateCommission } from '../affiliates/affiliates.service';
import { AppError } from '../../utils/AppError';

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function intervalLabel(interval: 'month' | 'year'): string {
  return interval === 'year' ? 'year' : 'month';
}

async function grantMembershipEntitlement(
  creatorId: string,
  productId: string,
  buyerEmail: string,
  orderId: string,
) {
  let entitlement = await EntitlementModel.findOne({ buyerEmail, productId });
  if (!entitlement) {
    try {
      entitlement = await EntitlementModel.create({
        creatorId,
        productId,
        orderId,
        buyerEmail,
        type: 'download',
      });
    } catch {
      entitlement = await EntitlementModel.findOne({ buyerEmail, productId });
    }
  } else if (entitlement.revokedAt) {
    entitlement.revokedAt = undefined;
    entitlement.set('orderId', orderId);
    await entitlement.save();
  }
  return entitlement;
}

async function sendMembershipWelcomeEmail(
  buyerEmail: string,
  product: ProductDoc,
  order: { amountCents: number; currency: string },
  interval: string,
  accessUrl: string,
  fulfilmentUrl: string,
  branding: { username?: string; displayName: string; replyTo?: string },
): Promise<void> {
  const mailOpts = { fromName: branding.displayName, replyTo: branding.replyTo };
  const portalUrl = branding.username
    ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(buyerEmail)}`
    : undefined;

  await enqueueEmail(
    buyerEmail,
    'membership_welcome',
    {
      productTitle: product.title,
      amount: formatMoney(order.amountCents, order.currency),
      interval,
      accessUrl: accessUrl || fulfilmentUrl,
      fulfilmentUrl,
      creatorName: branding.displayName,
      portalUrl,
      thankYouMessage: product.thankYouMessage || '',
    },
    mailOpts,
  );
}

/** Idempotently fulfil a membership or payment-plan Checkout Session (initial subscription signup). */
export async function fulfilMembershipCheckout(
  session: Stripe.Checkout.Session,
  accountId?: string,
): Promise<void> {
  const creatorId = session.metadata?.creatorId;
  const productId = session.metadata?.productId;
  const buyerEmail =
    session.customer_details?.email?.toLowerCase() || session.customer_email?.toLowerCase();
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const itemType = session.metadata?.itemType ?? 'membership';
  const isPaymentPlan = itemType === 'payment_plan';

  if (!creatorId || !productId || !buyerEmail || !subscriptionId) {
    logger.warn({ sessionId: session.id }, 'Subscription checkout missing required fields');
    return;
  }
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    logger.info({ sessionId: session.id, status: session.payment_status }, 'Subscription session not paid; skipping');
    return;
  }

  const product = await ProductModel.findOne({ _id: productId, creatorId });
  if (!product) {
    logger.warn({ productId, creatorId }, 'Subscription product not found');
    return;
  }

  const interval = isPaymentPlan ? ('month' as const) : membershipBillingInterval(product);
  const installmentsTotal = isPaymentPlan
    ? Number(session.metadata?.installments || product.paymentPlanInstallments || 0)
    : 0;
  const paymentProvider = accountId?.startsWith('paypal') ? 'paypal' : 'stripe';

  let order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
  let isNew = false;
  if (!order) {
    const amountCents = session.amount_total ?? product.priceCents;
    const affiliateFields = await affiliateFieldsForOrder(
      product,
      amountCents,
      session.metadata?.affiliateRef,
    );
    try {
      order = await OrderModel.create({
        creatorId,
        productId,
        buyerEmail,
        amountCents,
        currency: session.currency ?? product.currency,
        applicationFeeCents:
          typeof session.metadata?.fee === 'string' ? Number(session.metadata.fee) : 0,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        stripeSubscriptionId: subscriptionId,
        stripeAccountId: accountId,
        paymentProvider,
        status: 'paid',
        fulfilmentStatus: 'pending',
        orderKind: 'subscription_initial',
        paidAt: new Date(),
        source: session.metadata?.source ?? '',
        discountCode: session.metadata?.discountCode ?? '',
        ...affiliateFields,
      });
      isNew = true;
    } catch {
      order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
    }
  }
  if (!order) return;

  const entitlement = await grantMembershipEntitlement(creatorId, productId, buyerEmail, order.id);
  if (!entitlement) return;

  const accessUrl = product.accessUrl?.trim() || '';
  const fulfilmentUrl = `${env.APP_URL}/access/${entitlement.accessToken}`;

  let membership = await BuyerMembershipModel.findOne({ stripeSubscriptionId: subscriptionId });
  if (!membership) {
    try {
      membership = await BuyerMembershipModel.create({
        creatorId,
        productId,
        buyerEmail,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : '',
        stripeCheckoutSessionId: session.id,
        stripeAccountId: accountId ?? '',
        billingInterval: interval,
        status: 'active',
        entitlementId: entitlement._id,
        planType: isPaymentPlan ? 'payment_plan' : 'membership',
        installmentsTotal,
        installmentsPaid: 1,
      });
    } catch {
      membership = await BuyerMembershipModel.findOne({ stripeSubscriptionId: subscriptionId });
    }
  }

  if (order.fulfilmentStatus !== 'fulfilled') {
    const branding = await resolveCreatorBranding(creatorId).catch(() => ({
      displayName: 'CreatorStore',
      username: '',
      replyTo: undefined as string | undefined,
    }));
    const welcomeInterval = isPaymentPlan
      ? `month (1 of ${installmentsTotal})`
      : intervalLabel(interval);
    await sendMembershipWelcomeEmail(
      buyerEmail,
      product,
      order,
      welcomeInterval,
      accessUrl,
      fulfilmentUrl,
      branding,
    );
    order.fulfilmentStatus = 'fulfilled';
    await order.save();
  }

  if (isNew) {
    await ProductModel.updateOne({ _id: productId }, { $inc: { salesCount: 1, grossCents: order.amountCents } });
    await upsertCustomerLead(creatorId, buyerEmail, session.metadata?.buyerName).catch(() => {});
    await triggerFlows(creatorId, buyerEmail, 'purchase').catch(() => {});
    await triggerProductEmailFlows(product, buyerEmail).catch(() => {});
    await recordAffiliateCommission(order, product).catch(() => {});
    await notifyCreatorNewSale(creatorId, {
      itemTitle: product.title,
      itemKind: 'product',
      amount: formatMoney(order.amountCents, order.currency),
      buyerEmail,
      buyerName: session.metadata?.buyerName,
      orderId: order.id,
    }).catch(() => {});
  }

  recordAudit({
    action: isPaymentPlan ? 'payment_plan.started' : 'membership.subscribed',
    actorType: 'system',
    creatorId,
    targetType: 'product',
    targetId: productId,
    metadata: { sessionId: session.id, subscriptionId, isNew, installmentsTotal },
  });
}

/** Record a recurring invoice payment and optionally email the subscriber. */
export async function handleMembershipInvoicePaid(
  invoice: Stripe.Invoice,
  accountId?: string,
): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return;
  if (invoice.billing_reason === 'subscription_create') return;

  const membership = await BuyerMembershipModel.findOne({ stripeSubscriptionId: subscriptionId });
  if (!membership) return;

  const existing = await OrderModel.findOne({ stripeInvoiceId: invoice.id });
  if (existing) return;

  const product = await ProductModel.findById(membership.productId);
  if (!product) return;

  const amountCents = invoice.amount_paid ?? 0;
  const creatorId = String(membership.creatorId);

  let order;
  try {
    order = await OrderModel.create({
      creatorId,
      productId: membership.productId,
      buyerEmail: membership.buyerEmail,
      amountCents,
      currency: invoice.currency ?? product.currency,
      applicationFeeCents: 0,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      stripeAccountId: accountId,
      paymentProvider: 'stripe',
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      orderKind: 'subscription_renewal',
      paidAt: new Date((invoice.status_transitions?.paid_at ?? Date.now() / 1000) * 1000),
    });
  } catch {
    return;
  }

  await ProductModel.updateOne({ _id: product._id }, { $inc: { grossCents: amountCents } });

  if (membership.planType === 'payment_plan') {
    membership.installmentsPaid = (membership.installmentsPaid ?? 0) + 1;
    await membership.save();
  }

  const creator = await UserModel.findById(creatorId).select('notificationPrefs');
  const creatorPrefs = creator?.get('notificationPrefs') as Record<string, boolean> | undefined;

  if (isNotificationPrefEnabled(creatorPrefs, 'recurringPayments')) {
    const branding = await resolveCreatorBranding(creatorId).catch(() => ({
      displayName: 'CreatorStore',
      username: '',
      replyTo: undefined as string | undefined,
    }));
    const entitlement = await EntitlementModel.findOne({
      buyerEmail: membership.buyerEmail,
      productId: membership.productId,
    });
    const fulfilmentUrl = entitlement
      ? `${env.APP_URL}/access/${entitlement.accessToken}`
      : product.accessUrl || env.APP_URL;

    await enqueueEmail(
      membership.buyerEmail,
      'recurring_payment',
      {
        productTitle: product.title,
        amount: formatMoney(amountCents, invoice.currency ?? product.currency),
        interval:
          membership.planType === 'payment_plan' && membership.installmentsTotal > 0
            ? `month (${membership.installmentsPaid} of ${membership.installmentsTotal})`
            : intervalLabel(membership.billingInterval as 'month' | 'year'),
        accessUrl: product.accessUrl?.trim() || fulfilmentUrl,
        fulfilmentUrl,
        creatorName: branding.displayName,
      },
      {
        fromName: branding.displayName,
        replyTo: branding.replyTo,
        dedupeKey: `recurring_payment:${invoice.id}`,
      },
    ).catch(() => {});
  }

  if (isNotificationPrefEnabled(creatorPrefs, 'purchaseConfirmations')) {
    await notifyCreatorNewSale(creatorId, {
      itemTitle: product.title,
      itemKind: 'product',
      amount: formatMoney(amountCents, invoice.currency ?? product.currency),
      buyerEmail: membership.buyerEmail,
      orderId: order.id,
    }).catch(() => {});
  }

  recordAudit({
    action: 'membership.renewed',
    actorType: 'system',
    creatorId,
    targetType: 'order',
    targetId: order.id,
    metadata: { invoiceId: invoice.id, subscriptionId, amountCents },
  });
}

/** Revoke access when a subscription ends. */
export async function handleMembershipSubscriptionEnded(
  subscription: Stripe.Subscription,
  accountId?: string,
): Promise<void> {
  const membership = await BuyerMembershipModel.findOne({
    stripeSubscriptionId: subscription.id,
  });
  if (!membership || membership.status === 'canceled') return;

  const completedPaymentPlan =
    membership.planType === 'payment_plan' &&
    membership.installmentsTotal > 0 &&
    (membership.installmentsPaid ?? 0) >= membership.installmentsTotal;

  if (completedPaymentPlan) {
    membership.status = 'canceled';
    membership.canceledAt = new Date();
    if (subscription.current_period_end) {
      membership.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    }
    await membership.save();
    recordAudit({
      action: 'payment_plan.completed',
      actorType: 'system',
      creatorId: String(membership.creatorId),
      targetType: 'product',
      targetId: String(membership.productId),
      metadata: { subscriptionId: subscription.id, installmentsPaid: membership.installmentsPaid },
    });
    return;
  }

  membership.status = 'canceled';
  membership.canceledAt = new Date();
  membership.cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  if (subscription.current_period_end) {
    membership.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }
  await membership.save();

  await EntitlementModel.updateMany(
    { _id: membership.entitlementId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  const product = await ProductModel.findById(membership.productId);
  const branding = await resolveCreatorBranding(String(membership.creatorId)).catch(() => ({
    displayName: 'CreatorStore',
    username: '',
    replyTo: undefined as string | undefined,
  }));

  await enqueueEmail(
    membership.buyerEmail,
    'membership_cancelled',
    {
      productTitle: product?.title ?? 'Membership',
      creatorName: branding.displayName,
      reason: subscription.cancellation_details?.reason
        ? String(subscription.cancellation_details.reason)
        : undefined,
    },
    {
      fromName: branding.displayName,
      replyTo: branding.replyTo,
      dedupeKey: `membership_cancelled:${subscription.id}`,
    },
  ).catch(() => {});

  await notifyCreatorIfEnabled(
    String(membership.creatorId),
    'membershipCancellations',
    'creator_membership_cancelled',
    {
      creatorName: branding.displayName,
      productTitle: product?.title ?? 'Membership',
      buyerEmail: membership.buyerEmail,
      buyerName: membership.buyerEmail,
      leadsUrl: `${env.APP_URL}/dashboard/leads`,
    },
    `membership_cancel:${subscription.id}`,
  ).catch(() => {});

  recordAudit({
    action: 'membership.canceled',
    actorType: 'system',
    creatorId: String(membership.creatorId),
    targetType: 'product',
    targetId: String(membership.productId),
    metadata: { subscriptionId: subscription.id, accountId },
  });
}

/** Keep membership status in sync on subscription updates. */
export async function handleMembershipSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const membership = await BuyerMembershipModel.findOne({
    stripeSubscriptionId: subscription.id,
  });
  if (!membership) return;

  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    await handleMembershipSubscriptionEnded(subscription);
    return;
  }

  membership.status =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? subscription.status
      : subscription.status === 'past_due'
        ? 'past_due'
        : membership.status;
  membership.cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  if (subscription.current_period_end) {
    membership.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }
  await membership.save();
}

/** Notify buyer when a subscription invoice payment fails. */
export async function handleMembershipInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return;

  const membership = await BuyerMembershipModel.findOne({ stripeSubscriptionId: subscriptionId });
  if (!membership) return;

  membership.status = 'past_due';
  await membership.save();

  const product = await ProductModel.findById(membership.productId);
  if (!product) return;

  const creatorId = String(membership.creatorId);
  const branding = await resolveCreatorBranding(creatorId).catch(() => ({
    displayName: 'CreatorStore',
    username: '',
    replyTo: undefined as string | undefined,
  }));
  const amountCents = invoice.amount_due ?? invoice.total ?? product.priceCents;

  await enqueueEmail(
    membership.buyerEmail,
    'membership_payment_failed',
    {
      productTitle: product.title,
      amount: formatMoney(amountCents, invoice.currency ?? product.currency),
      creatorName: branding.displayName,
    },
    {
      fromName: branding.displayName,
      replyTo: branding.replyTo,
      dedupeKey: `membership_payment_failed:${invoice.id}`,
    },
  ).catch(() => {});

  recordAudit({
    action: 'membership.payment_failed',
    actorType: 'system',
    creatorId,
    targetType: 'product',
    targetId: String(product._id),
    metadata: { invoiceId: invoice.id, subscriptionId },
  });
}

/**
 * Dev/demo helper: simulate a renewal or cancellation webhook for a membership
 * without Stripe CLI. Only for local testing.
 */
export async function simulateMembershipEvent(
  creatorId: string,
  input: { event: 'renewal' | 'cancel'; subscriptionId: string },
): Promise<{ ok: true }> {
  const membership = await BuyerMembershipModel.findOne({
    stripeSubscriptionId: input.subscriptionId,
    creatorId,
  });
  if (!membership) throw AppError.notFound('Membership not found');

  const product = await ProductModel.findById(membership.productId);
  if (!product) throw AppError.notFound('Product not found');

  if (input.event === 'renewal') {
    const invoice = {
      id: `demo_inv_${randomUUID()}`,
      object: 'invoice',
      subscription: input.subscriptionId,
      billing_reason: 'subscription_cycle',
      amount_paid: sessionInstallmentCents(product, membership),
      currency: product.currency,
      status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
    } as Stripe.Invoice;
    await handleMembershipInvoicePaid(invoice, membership.stripeAccountId || 'acct_demo');
  } else {
    const subscription = {
      id: input.subscriptionId,
      object: 'subscription',
      status: 'canceled',
      cancel_at_period_end: false,
      cancellation_details: { reason: 'cancellation_requested' },
    } as Stripe.Subscription;
    await handleMembershipSubscriptionEnded(subscription, membership.stripeAccountId);
  }

  return { ok: true };
}

function sessionInstallmentCents(
  product: ProductDoc,
  membership: { planType?: string; installmentsTotal?: number },
): number {
  if (membership.planType === 'payment_plan' && (membership.installmentsTotal ?? 0) > 1) {
    return paymentPlanInstallmentCents(product.priceCents, membership.installmentsTotal!);
  }
  if (product.discountPriceCents > 0 && product.discountPriceCents < product.priceCents) {
    return product.discountPriceCents;
  }
  return product.priceCents;
}
