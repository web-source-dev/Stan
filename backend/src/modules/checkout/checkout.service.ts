import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { requireStripe, applicationFee } from '../../lib/stripe';
import { ProductModel } from '../../models/Product';
import { CourseModel } from '../../models/Course';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { EntitlementModel } from '../../models/Entitlement';
import { EnrollmentModel } from '../../models/Enrollment';
import { getConnectedAccountId, canAcceptPayments } from '../payments/connect.service';
import { recordAudit } from '../../lib/audit';

const DEMO_BUYER_EMAIL = 'demo-buyer@stan.test';

/**
 * Build a synthetic "paid" Checkout Session that mirrors the shape the Stripe
 * webhook would deliver, so demo mode can reuse the real fulfilment pipeline.
 */
function demoSession(parts: {
  metadata: Record<string, string>;
  amountCents: number;
  currency: string;
  email: string;
}): Stripe.Checkout.Session {
  return {
    id: `demo_cs_${randomUUID()}`,
    object: 'checkout.session',
    payment_status: 'paid',
    customer_email: parts.email,
    customer_details: { email: parts.email },
    amount_total: parts.amountCents,
    currency: parts.currency,
    payment_intent: `demo_pi_${randomUUID()}`,
    metadata: parts.metadata,
  } as unknown as Stripe.Checkout.Session;
}

function demoSuccessUrl(kind: string, token?: string): string {
  const base = `${env.APP_URL}/checkout/success?demo=1&kind=${kind}`;
  return token ? `${base}&token=${token}` : base;
}

interface CheckoutInput {
  username: string;
  slug: string;
  email?: string;
  source?: string;
  campaign?: Record<string, unknown>;
}

/**
 * Create a Stripe Checkout Session for a published product, charged on the
 * creator's connected account with a platform application fee (destination
 * charge). Price is set inline via price_data, so we don't sync Stripe Product
 * objects. Returns the hosted Checkout URL.
 */
export async function createCheckoutSession(input: CheckoutInput) {
  const profile = await CreatorProfileModel.findOne({ username: input.username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');

  const creatorId = String(profile.userId);
  const product = await ProductModel.findOne({ creatorId, slug: input.slug, status: 'published' });
  if (!product) throw AppError.notFound('Product not found');

  if (product.priceCents <= 0) {
    // Free lead magnets are not a Stripe purchase; the frontend should use the
    // lead-capture flow instead.
    throw AppError.badRequest('This product is free and does not require checkout');
  }

  // Demo mode: simulate a paid purchase and grant access immediately.
  if (env.demoCheckout) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({
      metadata: { itemType: 'product', productId: product.id, creatorId, source: input.source ?? '' },
      amountCents: product.priceCents,
      currency: product.currency,
      email,
    });
    await fulfilCheckoutSession(session, 'acct_demo');
    const ent = await EntitlementModel.findOne({ buyerEmail: email, productId: product.id });
    return { url: demoSuccessUrl('product', ent?.accessToken), sessionId: session.id };
  }

  if (!(await canAcceptPayments(creatorId))) {
    throw new AppError(409, 'payments_not_ready', 'This creator cannot accept payments yet');
  }
  const connectedAccountId = await getConnectedAccountId(creatorId);
  if (!connectedAccountId) throw new AppError(409, 'payments_not_ready', 'Creator has no payout account');

  const fee = applicationFee(product.priceCents);
  const stripe = requireStripe();

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/${input.username}`,
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.priceCents,
            product_data: {
              name: product.title,
              description: product.shortDescription || undefined,
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: fee,
      },
      metadata: {
        itemType: 'product',
        productId: product.id,
        creatorId,
        source: input.source ?? '',
      },
    },
    { stripeAccount: connectedAccountId },
  );

  recordAudit({
    action: 'checkout.session_created',
    actorType: 'anonymous',
    creatorId,
    targetType: 'product',
    targetId: product.id,
    metadata: { sessionId: session.id },
  });

  return { url: session.url, sessionId: session.id };
}

/** Create a Checkout Session for a paid booking (slot already reserved). */
export async function createBookingCheckoutSession(input: {
  creatorId: string;
  bookingId: string;
  title: string;
  priceCents: number;
  currency: string;
  email: string;
  username: string;
}) {
  // Demo mode: confirm the reserved booking immediately (no Stripe).
  if (env.demoCheckout) {
    const { confirmBookingFromSession } = await import('../bookings/bookings.service');
    const session = demoSession({
      metadata: { itemType: 'booking', bookingId: input.bookingId, creatorId: input.creatorId },
      amountCents: input.priceCents,
      currency: input.currency,
      email: input.email,
    });
    await confirmBookingFromSession(session, 'acct_demo');
    return { url: demoSuccessUrl('booking'), sessionId: session.id };
  }

  const stripe = requireStripe();
  if (!(await canAcceptPayments(input.creatorId))) {
    throw new AppError(409, 'payments_not_ready', 'This creator cannot accept payments yet');
  }
  const connectedAccountId = await getConnectedAccountId(input.creatorId);
  if (!connectedAccountId) throw new AppError(409, 'payments_not_ready', 'Creator has no payout account');

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/${input.username}`,
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.priceCents,
            product_data: { name: input.title },
          },
        },
      ],
      payment_intent_data: { application_fee_amount: applicationFee(input.priceCents) },
      metadata: { itemType: 'booking', bookingId: input.bookingId, creatorId: input.creatorId },
    },
    { stripeAccount: connectedAccountId },
  );
  return { url: session.url, sessionId: session.id };
}

/** Create a Checkout Session to purchase a paid course (destination charge). */
export async function createCourseCheckoutSession(input: CheckoutInput) {
  const profile = await CreatorProfileModel.findOne({ username: input.username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const creatorId = String(profile.userId);

  const course = await CourseModel.findOne({ creatorId, slug: input.slug, status: 'published' });
  if (!course) throw AppError.notFound('Course not found');
  if (course.priceCents <= 0) throw AppError.badRequest('This course is free; use enroll instead');

  // Demo mode: simulate a paid purchase and enroll the buyer immediately.
  if (env.demoCheckout) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({
      metadata: { itemType: 'course', courseId: course.id, creatorId, source: input.source ?? '' },
      amountCents: course.priceCents,
      currency: course.currency,
      email,
    });
    await fulfilCheckoutSession(session, 'acct_demo');
    const enr = await EnrollmentModel.findOne({ buyerEmail: email, courseId: course.id });
    return { url: demoSuccessUrl('course', enr?.accessToken), sessionId: session.id };
  }

  if (!(await canAcceptPayments(creatorId))) {
    throw new AppError(409, 'payments_not_ready', 'This creator cannot accept payments yet');
  }
  const connectedAccountId = await getConnectedAccountId(creatorId);
  if (!connectedAccountId) throw new AppError(409, 'payments_not_ready', 'Creator has no payout account');

  const fee = applicationFee(course.priceCents);
  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/${input.username}`,
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: course.currency,
            unit_amount: course.priceCents,
            product_data: { name: course.title, description: course.shortDescription || undefined },
          },
        },
      ],
      payment_intent_data: { application_fee_amount: fee },
      metadata: { itemType: 'course', courseId: course.id, creatorId, source: input.source ?? '' },
    },
    { stripeAccount: connectedAccountId },
  );

  recordAudit({ action: 'checkout.session_created', actorType: 'anonymous', creatorId, targetType: 'course', targetId: course.id, metadata: { sessionId: session.id } });
  return { url: session.url, sessionId: session.id };
}
