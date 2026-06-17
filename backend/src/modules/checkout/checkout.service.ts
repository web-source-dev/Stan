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
import { computeCheckoutPricing } from './checkout-pricing';
import { upsertCustomerLead } from '../leads/leads.service';

const DEMO_BUYER_EMAIL = 'demo-buyer@stan.test';

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

export interface CheckoutInput {
  username: string;
  slug: string;
  email?: string;
  name?: string;
  source?: string;
  campaign?: Record<string, unknown>;
  discountCode?: string;
  orderBump?: boolean;
  affiliateRef?: string;
  customFieldValues?: Record<string, string>;
}

function buildProductDescription(
  product: { shortDescription?: string },
  pricing: ReturnType<typeof computeCheckoutPricing>,
): string | undefined {
  const parts: string[] = [];
  if (product.shortDescription) parts.push(product.shortDescription);
  if (pricing.paymentPlanNote) parts.push(pricing.paymentPlanNote);
  if (pricing.appliedDiscountCode) parts.push(`Discount code ${pricing.appliedDiscountCode} applied`);
  return parts.length ? parts.join(' · ') : undefined;
}

async function loadPublishedProduct(username: string, slug: string) {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const creatorId = String(profile.userId);
  const product = await ProductModel.findOne({ creatorId, slug, status: 'published' });
  if (!product) throw AppError.notFound('Product not found');
  return { profile, creatorId, product };
}

function validateCustomFields(
  product: { customFields: { _id?: unknown; label: string; required: boolean }[] },
  values: Record<string, string> = {},
): void {
  for (const field of product.customFields) {
    const key = String(field._id);
    const val = (values[key] ?? values[field.label] ?? '').trim();
    if (field.required && !val) {
      throw AppError.badRequest(`Please fill in: ${field.label}`);
    }
  }
}

export async function createCheckoutSession(input: CheckoutInput) {
  const { creatorId, product } = await loadPublishedProduct(input.username, input.slug);

  if (product.priceCents <= 0) {
    throw AppError.badRequest('This product is free — use the claim endpoint instead');
  }

  validateCustomFields(product, input.customFieldValues);
  const pricing = computeCheckoutPricing(product, {
    discountCode: input.discountCode,
    orderBump: input.orderBump,
  });

  const metadata: Record<string, string> = {
    itemType: 'product',
    productId: product.id,
    creatorId,
    source: input.source ?? '',
  };
  if (pricing.appliedDiscountCode) metadata.discountCode = pricing.appliedDiscountCode;
  if (input.orderBump && pricing.orderBumpCents > 0) metadata.orderBump = '1';
  if (input.affiliateRef) metadata.affiliateRef = input.affiliateRef;
  if (input.name) metadata.buyerName = input.name;
  if (input.customFieldValues && Object.keys(input.customFieldValues).length) {
    metadata.customFields = JSON.stringify(input.customFieldValues).slice(0, 450);
  }
  // Record the platform fee in metadata so fulfilment can persist it on the
  // order (both the demo and live paths read session.metadata.fee).
  const fee = applicationFee(pricing.totalCents);
  metadata.fee = String(fee);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: product.currency,
        unit_amount: pricing.finalCents,
        product_data: {
          name: product.title,
          description: buildProductDescription(product, pricing),
        },
      },
    },
  ];
  if (pricing.orderBumpCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: product.currency,
        unit_amount: pricing.orderBumpCents,
        product_data: {
          name: product.orderBumpTitle || 'Order bump',
          description: product.orderBumpDescription || undefined,
        },
      },
    });
  }

  if (env.demoCheckout) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({
      metadata,
      amountCents: pricing.totalCents,
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

  const stripe = requireStripe();

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/${input.username}/product/${input.slug}`,
      customer_email: input.email,
      line_items: lineItems,
      payment_intent_data: { application_fee_amount: fee },
      metadata,
    },
    { stripeAccount: connectedAccountId },
  );

  recordAudit({
    action: 'checkout.session_created',
    actorType: 'anonymous',
    creatorId,
    targetType: 'product',
    targetId: product.id,
    metadata: { sessionId: session.id, totalCents: pricing.totalCents },
  });

  return { url: session.url, sessionId: session.id };
}

export async function claimFreeProduct(input: CheckoutInput & { email: string }) {
  const { creatorId, product } = await loadPublishedProduct(input.username, input.slug);
  if (product.priceCents > 0) {
    throw AppError.badRequest('This product requires payment');
  }

  validateCustomFields(product, input.customFieldValues);
  computeCheckoutPricing(product);

  const email = input.email.toLowerCase();
  const { fulfilFreeProduct } = await import('./fulfilment.service');
  const result = await fulfilFreeProduct({
    creatorId,
    product,
    buyerEmail: email,
    buyerName: input.name,
    source: input.source,
  });

  await upsertCustomerLead(creatorId, email, input.name).catch(() => {});

  return result;
}

export async function previewCheckoutPricing(input: {
  username: string;
  slug: string;
  discountCode?: string;
  orderBump?: boolean;
}) {
  const { product } = await loadPublishedProduct(input.username, input.slug);
  const pricing = computeCheckoutPricing(product, {
    discountCode: input.discountCode,
    orderBump: input.orderBump,
  });
  return {
    priceCents: product.priceCents,
    discountPriceCents: product.discountPriceCents,
    finalCents: pricing.finalCents,
    orderBumpCents: pricing.orderBumpCents,
    totalCents: pricing.totalCents,
    appliedDiscountCode: pricing.appliedDiscountCode,
    discountSavingsCents: pricing.discountSavingsCents,
    paymentPlanNote: pricing.paymentPlanNote,
    quantityRemaining:
      product.quantityLimit > 0 ? Math.max(0, product.quantityLimit - product.salesCount) : null,
    soldOut: product.quantityLimit > 0 && product.salesCount >= product.quantityLimit,
  };
}

export async function createBookingCheckoutSession(input: {
  creatorId: string;
  bookingId: string;
  title: string;
  priceCents: number;
  currency: string;
  email: string;
  username: string;
}) {
  const fee = applicationFee(input.priceCents);

  if (env.demoCheckout) {
    const { confirmBookingFromSession } = await import('../bookings/bookings.service');
    const session = demoSession({
      metadata: { itemType: 'booking', bookingId: input.bookingId, creatorId: input.creatorId, fee: String(fee) },
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
      payment_intent_data: { application_fee_amount: fee },
      metadata: { itemType: 'booking', bookingId: input.bookingId, creatorId: input.creatorId, fee: String(fee) },
    },
    { stripeAccount: connectedAccountId },
  );
  return { url: session.url, sessionId: session.id };
}

export async function createCourseCheckoutSession(input: CheckoutInput) {
  const profile = await CreatorProfileModel.findOne({ username: input.username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const creatorId = String(profile.userId);

  const course = await CourseModel.findOne({ creatorId, slug: input.slug, status: 'published' });
  if (!course) throw AppError.notFound('Course not found');
  if (course.priceCents <= 0) throw AppError.badRequest('This course is free; use enroll instead');

  const fee = applicationFee(course.priceCents);

  if (env.demoCheckout) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({
      metadata: {
        itemType: 'course',
        courseId: course.id,
        creatorId,
        source: input.source ?? '',
        fee: String(fee),
        ...(input.name ? { buyerName: input.name } : {}),
      },
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
      metadata: {
        itemType: 'course',
        courseId: course.id,
        creatorId,
        source: input.source ?? '',
        fee: String(fee),
        ...(input.name ? { buyerName: input.name } : {}),
      },
    },
    { stripeAccount: connectedAccountId },
  );

  recordAudit({ action: 'checkout.session_created', actorType: 'anonymous', creatorId, targetType: 'course', targetId: course.id, metadata: { sessionId: session.id } });
  return { url: session.url, sessionId: session.id };
}
