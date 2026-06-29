import type Stripe from 'stripe';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { OrderModel } from '../../models/Order';
import { EntitlementModel } from '../../models/Entitlement';
import { ProductModel, type ProductDoc } from '../../models/Product';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import { upsertCustomerLead } from '../leads/leads.service';
import { triggerFlows, triggerProductEmailFlows } from '../flows/flows.service';
import { CourseModel } from '../../models/Course';
import { EnrollmentModel } from '../../models/Enrollment';
import {
  notifyCreatorFulfillmentNeeded,
  notifyCreatorNewSale,
  resolveCreatorBranding,
} from '../../lib/creatorNotifications';
import { affiliateFieldsForOrder, recordAffiliateCommission } from '../affiliates/affiliates.service';

/**
 * Bump a product's sales counters at fulfilment. Revenue is always recorded.
 * salesCount is incremented atomically and capped at the quantity limit, so two
 * final sales racing past the checkout-time gate can never push the public
 * "sold out" state into an inconsistent state — the loser is honored (the buyer
 * paid) but the oversell is audited for the creator to reconcile.
 */
async function bumpProductSalesCounters(product: ProductDoc, grossCents: number): Promise<void> {
  if (grossCents > 0) {
    await ProductModel.updateOne({ _id: product._id }, { $inc: { grossCents } });
  }
  if (product.quantityLimit > 0) {
    const res = await ProductModel.updateOne(
      { _id: product._id, $expr: { $lt: ['$salesCount', '$quantityLimit'] } },
      { $inc: { salesCount: 1 } },
    );
    if (res.modifiedCount === 0) {
      recordAudit({
        action: 'product.oversold',
        actorType: 'system',
        creatorId: String(product.creatorId),
        targetType: 'product',
        targetId: String(product._id),
      });
    }
  } else {
    await ProductModel.updateOne({ _id: product._id }, { $inc: { salesCount: 1 } });
  }
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function personalizeConfirmText(text: string, product: ProductDoc, fulfilmentUrl: string, creatorUsername = ''): string {
  return text
    .replace(/\[Product Name\]/g, product.title)
    .replace(/\[My Username\]/g, creatorUsername)
    .replace(/\[Download Link\]/g, fulfilmentUrl)
    .replace(/\[Access Link\]/g, fulfilmentUrl);
}

function parseBuyerCustomFields(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

async function sendCustomOrderReceivedEmail(
  buyerEmail: string,
  product: ProductDoc,
  order: { amountCents: number; currency: string },
  fulfilmentUrl: string,
  branding: { username?: string; displayName: string; replyTo?: string },
): Promise<void> {
  const amount = formatMoney(order.amountCents, order.currency);
  const portalUrl = branding.username
    ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(buyerEmail)}`
    : undefined;
  await enqueueEmail(
    buyerEmail,
    'custom_order_received',
    {
      productTitle: product.title,
      amount,
      fulfilmentUrl,
      fulfilmentNote: product.fulfilmentNote || '',
      creatorName: branding.displayName,
      portalUrl,
    },
    { fromName: branding.displayName, replyTo: branding.replyTo },
  );
}

async function sendProductConfirmationEmail(
  buyerEmail: string,
  product: ProductDoc,
  order: { amountCents: number; currency: string },
  fulfilmentUrl: string,
  branding: { username?: string; displayName: string; replyTo?: string },
): Promise<void> {
  const amount = formatMoney(order.amountCents, order.currency);
  const portalUrl = branding.username
    ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(buyerEmail)}`
    : undefined;
  const mailOpts = { fromName: branding.displayName, replyTo: branding.replyTo };

  if (product.confirmSubject.trim() || product.confirmBody.trim()) {
    const subject = personalizeConfirmText(
      product.confirmSubject.trim() || `Your purchase: ${product.title}`,
      product,
      fulfilmentUrl,
      branding.username ?? '',
    );
    const bodyText = personalizeConfirmText(
      product.confirmBody.trim() ||
        `Thanks for purchasing ${product.title}.\n\nAccess your purchase: ${fulfilmentUrl}`,
      product,
      fulfilmentUrl,
      branding.username ?? '',
    );
    await enqueueEmail(
      buyerEmail,
      'broadcast',
      {
        subject,
        bodyText:
          `${bodyText}\n\n${product.thankYouMessage ? product.thankYouMessage + '\n\n' : ''}Access link: ${fulfilmentUrl}` +
          (portalUrl ? `\n\nView all your purchases: ${portalUrl}` : ''),
        fromName: branding.displayName,
      },
      mailOpts,
    );
    return;
  }

  await enqueueEmail(
    buyerEmail,
    'purchase_receipt',
    {
      productTitle: product.title,
      amount,
      fulfilmentUrl,
      thankYouMessage: product.thankYouMessage || '',
      portalUrl,
      creatorName: branding.displayName,
    },
    mailOpts,
  );
}

async function notifyCreatorOnProductOrder(
  creatorId: string,
  product: ProductDoc,
  order: { id: string; amountCents: number; currency: string },
  buyerEmail: string,
  buyerName?: string,
): Promise<void> {
  const amount = formatMoney(order.amountCents, order.currency);
  await notifyCreatorNewSale(creatorId, {
    itemTitle: product.title,
    itemKind: 'product',
    amount,
    buyerEmail,
    buyerName,
    orderId: order.id,
  }).catch(() => {});
  if (product.productKind === 'custom') {
    await notifyCreatorFulfillmentNeeded(creatorId, {
      productTitle: product.title,
      buyerEmail,
      buyerName,
      amount,
      orderId: order.id,
      fulfilmentNote: product.fulfilmentNote || '',
    }).catch(() => {});
  }
}

async function grantProductEntitlement(
  creatorId: string,
  productId: string,
  buyerEmail: string,
  orderId?: string,
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
  }
  return entitlement;
}

/** Fulfil a free product (lead magnet) without a Stripe session. */
export async function fulfilFreeProduct(input: {
  creatorId: string;
  product: ProductDoc;
  buyerEmail: string;
  buyerName?: string;
  source?: string;
}): Promise<{ url: string; accessToken: string }> {
  const { creatorId, product, buyerEmail } = input;
  const productId = product.id;

  let order = await OrderModel.findOne({
    creatorId,
    productId,
    buyerEmail,
    amountCents: 0,
    status: 'paid',
  });
  let isNew = false;
  if (!order) {
    order = await OrderModel.create({
      creatorId,
      productId,
      buyerEmail,
      buyerName: input.buyerName ?? '',
      amountCents: 0,
      currency: product.currency,
      paymentProvider: 'free',
      status: 'paid',
      fulfilmentStatus: 'pending',
      paidAt: new Date(),
      source: input.source ?? 'product',
    });
    isNew = true;
  }

  const entitlement = await grantProductEntitlement(creatorId, productId, buyerEmail, order.id);
  if (!entitlement) throw new Error('Failed to grant access');

  if (isNew) {
    await bumpProductSalesCounters(product, 0);
  }

  if (order.fulfilmentStatus !== 'fulfilled') {
    const branding = await resolveCreatorBranding(creatorId).catch(() => ({
      displayName: 'CreatorStore',
      username: '',
      replyTo: undefined as string | undefined,
    }));
    const fulfilmentUrl = `${env.APP_URL}/access/${entitlement.accessToken}`;
    if (product.productKind === 'custom') {
      if (isNew) await sendCustomOrderReceivedEmail(buyerEmail, product, order, fulfilmentUrl, branding);
    } else {
      await sendProductConfirmationEmail(buyerEmail, product, order, fulfilmentUrl, branding);
      order.fulfilmentStatus = 'fulfilled';
    }
    await order.save();
    if (isNew) {
      await triggerFlows(creatorId, buyerEmail, 'lead').catch(() => {});
      await triggerProductEmailFlows(product, buyerEmail).catch(() => {});
    }
  }

  return { url: `${env.APP_URL}/access/${entitlement.accessToken}`, accessToken: entitlement.accessToken };
}

/**
 * Idempotently fulfil a completed Checkout Session: create the order, grant the
 * entitlement, bump product counters, and enqueue the receipt/fulfilment email.
 * Safe to call multiple times for the same session (webhook retries) — keyed by
 * the unique stripeCheckoutSessionId and (buyerEmail, productId) entitlement.
 *
 * `accountId` is the connected account the session belongs to (from the event).
 */
export async function fulfilCheckoutSession(
  session: Stripe.Checkout.Session,
  accountId?: string,
): Promise<void> {
  const creatorId = session.metadata?.creatorId;
  const buyerEmail =
    session.customer_details?.email?.toLowerCase() || session.customer_email?.toLowerCase();

  if (!creatorId || !buyerEmail) {
    logger.warn({ sessionId: session.id }, 'Checkout session missing metadata/email; skipping');
    return;
  }
  const itemType = session.metadata?.itemType;
  const isRecurringProduct = itemType === 'membership' || itemType === 'payment_plan';
  if (!isRecurringProduct && session.payment_status !== 'paid') {
    logger.info({ sessionId: session.id, status: session.payment_status }, 'Session not paid; skipping');
    return;
  }

  if (isRecurringProduct) {
    const { fulfilMembershipCheckout } = await import('./membership.service');
    await fulfilMembershipCheckout(session, accountId);
    return;
  }

  // Which payment rail settled this — derived from the fulfilment account tag.
  const paymentProvider = accountId?.startsWith('paypal') ? 'paypal' : 'stripe';

  // Course purchases follow the enrollment path, not the product entitlement path.
  if (session.metadata?.itemType === 'course') {
    await fulfilCourseSession(session, creatorId, buyerEmail, accountId);
    return;
  }

  // Booking purchases confirm the reserved slot.
  if (session.metadata?.itemType === 'booking') {
    const { confirmBookingFromSession } = await import('../bookings/bookings.service');
    await confirmBookingFromSession(session, accountId);
    return;
  }

  // Webinar registrations confirm after payment.
  if (session.metadata?.itemType === 'webinar') {
    const { confirmWebinarFromSession } = await import('../webinars/webinars.service');
    await confirmWebinarFromSession(session, accountId);
    return;
  }

  const productId = session.metadata?.productId;
  if (!productId) {
    logger.warn({ sessionId: session.id }, 'Checkout session missing productId; skipping');
    return;
  }

  const product = await ProductModel.findOne({ _id: productId, creatorId });
  if (!product) {
    logger.warn({ productId, creatorId }, 'Product not found during fulfilment');
    return;
  }

  // Idempotent order upsert keyed by the checkout session id.
  const existing = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
  let isNew = false;
  let order = existing;
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
        buyerName: session.metadata?.buyerName ?? '',
        buyerCustomFields: parseBuyerCustomFields(session.metadata?.customFields),
        amountCents,
        currency: session.currency ?? product.currency,
        applicationFeeCents:
          typeof session.metadata?.fee === 'string' ? Number(session.metadata.fee) : 0,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        stripeAccountId: accountId,
        paymentProvider,
        status: 'paid',
        fulfilmentStatus: 'pending',
        paidAt: new Date(),
        source: session.metadata?.source ?? '',
        discountCode: session.metadata?.discountCode ?? '',
        ...affiliateFields,
      });
      isNew = true;
    } catch (err) {
      // Unique-index race: another delivery created it first. Re-read and continue.
      order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
      if (!order) throw err;
    }
  }
  if (!order) return;

  // Grant entitlement (idempotent on buyerEmail+productId).
  const entitlement = await grantProductEntitlement(creatorId, productId, buyerEmail, order.id);

  if (isNew) {
    await bumpProductSalesCounters(product, order.amountCents);
    // Add the buyer to the creator's contacts, flagged as a customer.
    await upsertCustomerLead(creatorId, buyerEmail, session.metadata?.buyerName).catch(() => {});
  }

  // Enqueue receipt + fulfilment email (durable, retried by the job runner).
  if (order.fulfilmentStatus !== 'fulfilled' && entitlement) {
    const fulfilmentUrl = `${env.APP_URL}/access/${entitlement.accessToken}`;
    const branding = await resolveCreatorBranding(creatorId).catch(() => ({
      displayName: 'CreatorStore',
      username: '',
      replyTo: undefined as string | undefined,
    }));
    const isCustom = product.productKind === 'custom';
    if (isCustom) {
      if (isNew) await sendCustomOrderReceivedEmail(buyerEmail, product, order, fulfilmentUrl, branding);
    } else {
      await sendProductConfirmationEmail(buyerEmail, product, order, fulfilmentUrl, branding);
      order.fulfilmentStatus = 'fulfilled';
    }
    await order.save();
    if (isNew) {
      await triggerFlows(creatorId, buyerEmail, 'purchase').catch(() => {});
      await triggerProductEmailFlows(product, buyerEmail).catch(() => {});
      await recordAffiliateCommission(order, product).catch(() => {});
      if (order.amountCents > 0) {
        await notifyCreatorOnProductOrder(
          creatorId,
          product,
          { id: order.id, amountCents: order.amountCents, currency: order.currency },
          buyerEmail,
          session.metadata?.buyerName,
        ).catch(() => {});
      }
    }
  }

  recordAudit({
    action: product.productKind === 'custom' && order.fulfilmentStatus !== 'fulfilled' ? 'order.awaiting_fulfillment' : 'order.fulfilled',
    actorType: 'system',
    creatorId,
    targetType: 'order',
    targetId: order.id,
    metadata: { sessionId: session.id, isNew },
  });
}

/**
 * Idempotently fulfil a paid course Checkout Session: create the order, enroll
 * the buyer, bump counters, and email the course-access link.
 */
async function fulfilCourseSession(
  session: Stripe.Checkout.Session,
  creatorId: string,
  buyerEmail: string,
  accountId?: string,
): Promise<void> {
  const courseId = session.metadata?.courseId;
  if (!courseId) return;
  const course = await CourseModel.findOne({ _id: courseId, creatorId });
  if (!course) {
    logger.warn({ courseId, creatorId }, 'Course not found during fulfilment');
    return;
  }

  let order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
  let isNew = false;
  if (!order) {
    try {
      order = await OrderModel.create({
        creatorId,
        productId: courseId, // reuse the order line as the purchased item ref
        buyerEmail,
        amountCents: session.amount_total ?? course.priceCents,
        currency: session.currency ?? course.currency,
        applicationFeeCents:
          typeof session.metadata?.fee === 'string' ? Number(session.metadata.fee) : 0,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        stripeAccountId: accountId,
        paymentProvider: accountId?.startsWith('paypal') ? 'paypal' : 'stripe',
        status: 'paid',
        fulfilmentStatus: 'pending',
        paidAt: new Date(),
        source: session.metadata?.source ?? '',
        discountCode: session.metadata?.discountCode ?? '',
      });
      isNew = true;
    } catch {
      order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
    }
  }
  if (!order) return;

  const enrollment = await enrollBuyer(creatorId, courseId, buyerEmail, order.id);

  if (isNew) {
    await CourseModel.updateOne({ _id: courseId }, { $inc: { enrollmentCount: 1, grossCents: order.amountCents } });
    await upsertCustomerLead(creatorId, buyerEmail, session.metadata?.buyerName).catch(() => {});
  }

  if (order.fulfilmentStatus !== 'fulfilled') {
    const branding = await resolveCreatorBranding(creatorId).catch(() => ({
      displayName: 'CreatorStore',
      username: '',
      replyTo: undefined as string | undefined,
    }));
    const portalUrl = branding.username
      ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(buyerEmail)}`
      : undefined;
    const learnUrl = `${env.APP_URL}/learn/${enrollment.accessToken}`;
    const amount = formatMoney(order.amountCents, order.currency);
    await enqueueEmail(
      buyerEmail,
      'course_enrollment',
      {
        courseTitle: course.title,
        amount,
        learnUrl,
        creatorName: branding.displayName,
        portalUrl,
      },
      { fromName: branding.displayName, replyTo: branding.replyTo },
    );
    order.fulfilmentStatus = 'fulfilled';
    await order.save();
    if (isNew) {
      await triggerFlows(creatorId, buyerEmail, 'purchase').catch(() => {});
      if (order.amountCents > 0) {
        await notifyCreatorNewSale(creatorId, {
          itemTitle: course.title,
          itemKind: 'course',
          amount,
          buyerEmail,
          buyerName: session.metadata?.buyerName,
          orderId: order.id,
        }).catch(() => {});
      }
    }
  }
  recordAudit({ action: 'course.enrolled', actorType: 'system', creatorId, targetType: 'course', targetId: courseId, metadata: { sessionId: session.id } });
}

/** Create (or fetch) an enrollment for a buyer+course. */
export async function enrollBuyer(creatorId: string, courseId: string, buyerEmail: string, orderId?: string) {
  let enrollment = await EnrollmentModel.findOne({ buyerEmail, courseId });
  if (!enrollment) {
    try {
      enrollment = await EnrollmentModel.create({ creatorId, courseId, buyerEmail, orderId });
    } catch {
      enrollment = await EnrollmentModel.findOne({ buyerEmail, courseId });
    }
  }
  if (!enrollment) throw new Error('Failed to create enrollment');
  return enrollment;
}

/** Mark an order refunded (driven by charge.refunded). */
export async function markRefunded(paymentIntentId: string): Promise<void> {
  const order = await OrderModel.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!order || order.status === 'refunded') return;
  order.status = 'refunded';
  order.refundedAt = new Date();
  await order.save();
  await EntitlementModel.updateMany(
    { orderId: order.id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  // Course purchases grant an Enrollment (not an Entitlement) — revoke those too
  // so a refunded buyer loses course access.
  await EnrollmentModel.updateMany(
    { orderId: order.id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  // Booking purchases — cancel the confirmed slot and notify the buyer.
  if (order.stripeCheckoutSessionId) {
    const { cancelBookingByCheckoutSession } = await import('../bookings/bookings.service');
    await cancelBookingByCheckoutSession(order.stripeCheckoutSessionId).catch(() => {});
    const { cancelRegistrationByCheckoutSession } = await import('../webinars/webinars.service');
    await cancelRegistrationByCheckoutSession(order.stripeCheckoutSessionId).catch(() => {});
  }
  recordAudit({ action: 'order.refunded', actorType: 'system', creatorId: String(order.creatorId), targetType: 'order', targetId: order.id });
}
