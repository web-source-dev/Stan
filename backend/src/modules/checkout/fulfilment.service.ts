import type Stripe from 'stripe';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { OrderModel } from '../../models/Order';
import { EntitlementModel } from '../../models/Entitlement';
import { ProductModel } from '../../models/Product';
import { enqueueEmail } from '../../lib/jobs';
import { recordAudit } from '../../lib/audit';
import { upsertCustomerLead } from '../leads/leads.service';
import { triggerFlows } from '../flows/flows.service';
import { CourseModel } from '../../models/Course';
import { EnrollmentModel } from '../../models/Enrollment';

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
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
  if (session.payment_status !== 'paid') {
    logger.info({ sessionId: session.id, status: session.payment_status }, 'Session not paid; skipping');
    return;
  }

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
    try {
      order = await OrderModel.create({
        creatorId,
        productId,
        buyerEmail,
        amountCents: session.amount_total ?? product.priceCents,
        currency: session.currency ?? product.currency,
        applicationFeeCents:
          typeof session.metadata?.fee === 'string' ? Number(session.metadata.fee) : 0,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        stripeAccountId: accountId,
        status: 'paid',
        fulfilmentStatus: 'pending',
        paidAt: new Date(),
        source: session.metadata?.source ?? '',
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
  let entitlement = await EntitlementModel.findOne({ buyerEmail, productId });
  if (!entitlement) {
    try {
      entitlement = await EntitlementModel.create({
        creatorId,
        productId,
        orderId: order.id,
        buyerEmail,
        type: 'download',
      });
    } catch {
      entitlement = await EntitlementModel.findOne({ buyerEmail, productId });
    }
  }

  if (isNew) {
    await ProductModel.updateOne(
      { _id: productId },
      { $inc: { salesCount: 1, grossCents: order.amountCents } },
    );
    // Add the buyer to the creator's contacts, flagged as a customer.
    await upsertCustomerLead(creatorId, buyerEmail).catch(() => {});
  }

  // Enqueue receipt + fulfilment email (durable, retried by the job runner).
  if (order.fulfilmentStatus !== 'fulfilled' && entitlement) {
    const fulfilmentUrl = `${env.APP_URL}/access/${entitlement.accessToken}`;
    await enqueueEmail(buyerEmail, 'purchase_receipt', {
      productTitle: product.title,
      amount: formatMoney(order.amountCents, order.currency),
      fulfilmentUrl,
      thankYouMessage: product.thankYouMessage || '',
    });
    order.fulfilmentStatus = 'fulfilled';
    await order.save();
    // Kick off any post-purchase email flows (idempotent: only on first fulfil).
    if (isNew) await triggerFlows(creatorId, buyerEmail, 'purchase').catch(() => {});
  }

  recordAudit({
    action: 'order.fulfilled',
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
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        stripeAccountId: accountId,
        status: 'paid',
        fulfilmentStatus: 'pending',
        paidAt: new Date(),
        source: session.metadata?.source ?? '',
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
    await upsertCustomerLead(creatorId, buyerEmail).catch(() => {});
  }

  if (order.fulfilmentStatus !== 'fulfilled') {
    await enqueueEmail(buyerEmail, 'purchase_receipt', {
      productTitle: course.title,
      amount: formatMoney(order.amountCents, order.currency),
      fulfilmentUrl: `${env.APP_URL}/learn/${enrollment.accessToken}`,
    });
    order.fulfilmentStatus = 'fulfilled';
    await order.save();
    if (isNew) await triggerFlows(creatorId, buyerEmail, 'purchase').catch(() => {});
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
  recordAudit({ action: 'order.refunded', actorType: 'system', creatorId: String(order.creatorId), targetType: 'order', targetId: order.id });
}
