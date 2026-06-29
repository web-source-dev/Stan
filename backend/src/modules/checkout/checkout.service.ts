import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { requireStripe, applicationFee, APPLICATION_FEE_BPS } from '../../lib/stripe';
import { ProductModel } from '../../models/Product';
import { CourseModel } from '../../models/Course';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { EntitlementModel } from '../../models/Entitlement';
import { EnrollmentModel } from '../../models/Enrollment';
import { getConnectedAccountId, canAcceptPayments, getPayPalPayee } from '../payments/connect.service';
import { recordAudit } from '../../lib/audit';
import { computeCheckoutPricing, isMembershipProduct, isPaymentPlanProduct, membershipBillingInterval, paymentPlanInstallmentCents } from './checkout-pricing';
import { upsertCustomerLead } from '../leads/leads.service';
import { CheckoutIntentModel, type CheckoutIntentDoc } from '../../models/CheckoutIntent';
import { BookingModel } from '../../models/Booking';
import { createOrder, approveUrl, captureOrder, captureId } from '../../lib/paypal';

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

/** Post-checkout success URL (real payments). The success page fulfils via session_id. */
function stripeSuccessUrl(username: string, kind: string): string {
  return `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&username=${encodeURIComponent(username)}&kind=${kind}`;
}

/** Demo / PayPal immediate success (access token in URL). */
function successUrl(kind: string, token?: string): string {
  const base = `${env.APP_URL}/checkout/success?kind=${kind}`;
  return token ? `${base}&token=${token}` : base;
}

const INTENT_TTL_MS = 3 * 60 * 60 * 1000; // 3h

/**
 * Create a PayPal order + persist a checkout intent, returning the buyer-facing
 * approval URL. The intent carries the Stripe-shaped metadata so capture can
 * fulfil via the shared fulfilment path.
 */
async function startPayPalOrder(args: {
  creatorId: string;
  kind: 'product' | 'course' | 'booking' | 'webinar';
  metadata: Record<string, string>;
  amountCents: number;
  currency: string;
  email?: string;
  description?: string;
  brandName?: string;
  payeeEmail: string;
  cancelUrl: string;
}): Promise<{ url: string; paypalOrderId: string }> {
  const customId = `ci_${randomUUID()}`;
  const platformFeeCents =
    typeof args.metadata.fee === 'string' ? Number(args.metadata.fee) : applicationFee(args.amountCents);
  const order = await createOrder({
    amountCents: args.amountCents,
    currency: args.currency,
    description: args.description,
    payeeEmail: args.payeeEmail,
    customId,
    brandName: args.brandName,
    returnUrl: `${env.APP_URL}/checkout/paypal/return?kind=${args.kind}`,
    cancelUrl: args.cancelUrl,
    platformFeeCents: platformFeeCents > 0 ? platformFeeCents : undefined,
  });
  const url = approveUrl(order);
  if (!url) throw new AppError(502, 'paypal_error', 'PayPal did not return an approval link');

  await CheckoutIntentModel.create({
    provider: 'paypal',
    providerOrderId: order.id,
    creatorId: args.creatorId,
    kind: args.kind,
    metadata: args.metadata,
    amountCents: args.amountCents,
    currency: args.currency,
    buyerEmail: args.email?.toLowerCase() ?? '',
    successKind: args.kind,
    expiresAt: new Date(Date.now() + INTENT_TTL_MS),
  });

  return { url, paypalOrderId: order.id };
}

/** Re-derive the post-capture success URL (with the access token) for an intent. */
async function successUrlForIntent(intent: CheckoutIntentDoc): Promise<string> {
  const meta = (intent.metadata ?? {}) as Record<string, string>;
  if (intent.kind === 'product' && meta.productId) {
    const ent = await EntitlementModel.findOne({ buyerEmail: intent.buyerEmail, productId: meta.productId });
    return successUrl('product', ent?.accessToken);
  }
  if (intent.kind === 'course' && meta.courseId) {
    const enr = await EnrollmentModel.findOne({ buyerEmail: intent.buyerEmail, courseId: meta.courseId });
    return successUrl('course', enr?.accessToken);
  }
  if (intent.kind === 'booking' && meta.bookingId) {
    const booking = await BookingModel.findById(meta.bookingId).select('manageToken');
    return successUrl('booking', booking?.manageToken);
  }
  if (intent.kind === 'webinar' && meta.registrationId) {
    const { WebinarRegistrationModel } = await import('../../models/Webinar');
    const reg = await WebinarRegistrationModel.findById(meta.registrationId).select('manageToken');
    return successUrl('webinar', reg?.manageToken);
  }
  return successUrl(intent.kind);
}

/**
 * Capture an approved PayPal order and fulfil it through the shared path.
 * Idempotent: a completed intent (or a re-capture) returns the success URL
 * without re-fulfilling — fulfilment itself is also keyed by the order id.
 */
export async function capturePayPalOrder(orderId: string): Promise<{ url: string }> {
  const intent = await CheckoutIntentModel.findOne({ providerOrderId: orderId });
  if (!intent) throw AppError.notFound('Checkout not found or expired');
  if (intent.status === 'completed') return { url: await successUrlForIntent(intent) };

  const cap = await captureOrder(orderId);
  if (cap.status !== 'COMPLETED') {
    throw new AppError(402, 'paypal_not_completed', 'Your PayPal payment was not completed.');
  }
  const buyerEmail = (intent.buyerEmail || cap.payer?.email_address || '').toLowerCase();
  if (!buyerEmail) throw new AppError(400, 'paypal_no_email', 'PayPal did not return a buyer email');

  const { fulfilCheckoutSession } = await import('./fulfilment.service');
  const session = {
    id: `pp_${orderId}`,
    object: 'checkout.session',
    payment_status: 'paid',
    customer_email: buyerEmail,
    customer_details: { email: buyerEmail },
    amount_total: intent.amountCents,
    currency: intent.currency,
    payment_intent: captureId(cap) ?? `pp_${orderId}`,
    metadata: intent.metadata,
  } as unknown as Stripe.Checkout.Session;
  await fulfilCheckoutSession(session, 'paypal');

  intent.status = 'completed';
  intent.buyerEmail = buyerEmail;
  await intent.save();

  recordAudit({
    action: 'checkout.paypal_captured',
    actorType: 'anonymous',
    creatorId: String(intent.creatorId),
    targetType: intent.kind,
    targetId: (intent.metadata as Record<string, string>)?.productId ?? '',
    metadata: { orderId, amountCents: intent.amountCents },
  });

  return { url: await successUrlForIntent(intent) };
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
    orderBump: isMembershipProduct(product) || isPaymentPlanProduct(product) ? false : input.orderBump,
  });

  const membership = isMembershipProduct(product);
  const paymentPlan = isPaymentPlanProduct(product);
  const recurring = membership || paymentPlan;
  const interval = membership ? membershipBillingInterval(product) : paymentPlan ? ('month' as const) : null;
  const installmentCents =
    paymentPlan && product.paymentPlanInstallments > 1
      ? paymentPlanInstallmentCents(pricing.totalCents, product.paymentPlanInstallments)
      : pricing.finalCents;

  const metadata: Record<string, string> = {
    itemType: membership ? 'membership' : paymentPlan ? 'payment_plan' : 'product',
    productId: product.id,
    creatorId,
    source: input.source ?? '',
  };
  if (pricing.appliedDiscountCode) metadata.discountCode = pricing.appliedDiscountCode;
  if (!recurring && input.orderBump && pricing.orderBumpCents > 0) metadata.orderBump = '1';
  if (input.affiliateRef) metadata.affiliateRef = input.affiliateRef;
  if (input.name) metadata.buyerName = input.name;
  if (paymentPlan) metadata.installments = String(product.paymentPlanInstallments);
  if (input.customFieldValues && Object.keys(input.customFieldValues).length) {
    metadata.customFields = JSON.stringify(input.customFieldValues).slice(0, 450);
  }
  const fee = recurring ? applicationFee(installmentCents) : applicationFee(pricing.totalCents);
  metadata.fee = String(fee);

  if (env.demoCheckout) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({
      metadata,
      amountCents: recurring ? installmentCents : pricing.totalCents,
      currency: product.currency,
      email,
    }) as Stripe.Checkout.Session & { mode?: string; subscription?: string };
    if (recurring) {
      session.mode = 'subscription';
      session.subscription = `demo_sub_${randomUUID()}`;
    }
    await fulfilCheckoutSession(session, 'acct_demo');
    const ent = await EntitlementModel.findOne({ buyerEmail: email, productId: product.id });
    const kind = membership ? 'membership' : paymentPlan ? 'payment_plan' : 'product';
    return { url: demoSuccessUrl(kind, ent?.accessToken), sessionId: session.id };
  }

  if (!(await canAcceptPayments(creatorId))) {
    throw new AppError(
      409,
      'payments_not_ready',
      'This creator has not finished Stripe setup yet. Ask them to connect Stripe in Settings → Payments.',
    );
  }
  const connectedAccountId = await getConnectedAccountId(creatorId);
  if (!connectedAccountId) {
    throw new AppError(409, 'payments_not_ready', 'This creator cannot accept payments yet');
  }

  const stripe = requireStripe();

  if (recurring && interval) {
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      application_fee_percent: APPLICATION_FEE_BPS / 100,
      metadata: { ...metadata },
    };
    const cancelMonths = paymentPlan
      ? product.paymentPlanInstallments
      : product.cancelSubscriptionEnabled && product.cancelAfterMonths > 0
        ? product.cancelAfterMonths
        : 0;
    if (cancelMonths > 0) {
      const cancelAt = Math.floor(Date.now() / 1000) + cancelMonths * 30 * 24 * 3600;
      (subscriptionData as Stripe.Checkout.SessionCreateParams.SubscriptionData & { cancel_at?: number }).cancel_at =
        cancelAt;
    }

    const successKind = membership ? 'membership' : 'payment_plan';
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        success_url: stripeSuccessUrl(input.username, successKind),
        cancel_url: `${env.APP_URL}/${input.username}/product/${input.slug}`,
        customer_email: input.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: product.currency,
              unit_amount: installmentCents,
              recurring: { interval },
              product_data: {
                name: product.title,
                description: buildProductDescription(product, pricing),
              },
            },
          },
        ],
        subscription_data: subscriptionData,
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
      metadata: {
        sessionId: session.id,
        totalCents: installmentCents,
        recurring: true,
        paymentPlan,
      },
    });

    return { url: session.url, sessionId: session.id };
  }

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

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: stripeSuccessUrl(input.username, 'product'),
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

/** PayPal checkout for a product. Returns a redirect URL (approval or demo success). */
/** Which payment methods a creator's storefront can offer (drives the buyer UI). */
export async function getPaymentMethods(username: string): Promise<{
  card: boolean;
  paypal: boolean;
  stripeConfigured: boolean;
  demoCheckout: boolean;
}> {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const creatorId = String(profile.userId);
  const paypal = env.paypalDemo || (env.paypalConfigured && Boolean(await getPayPalPayee(creatorId)));
  const card = env.demoCheckout || (env.stripeConfigured && (await canAcceptPayments(creatorId)));
  return { card, paypal, stripeConfigured: env.stripeConfigured, demoCheckout: env.demoCheckout };
}

export async function createPayPalProductCheckout(input: CheckoutInput): Promise<{ url: string }> {
  const { creatorId, product, profile } = await loadPublishedProduct(input.username, input.slug);
  if (product.priceCents <= 0) throw AppError.badRequest('This product is free — use the claim endpoint instead');
  if (isMembershipProduct(product)) {
    throw AppError.badRequest('Membership subscriptions require card checkout — PayPal is not supported for recurring billing.');
  }
  if (isPaymentPlanProduct(product)) {
    throw AppError.badRequest('Payment plans require card checkout — PayPal is not supported for installments.');
  }

  validateCustomFields(product, input.customFieldValues);
  const pricing = computeCheckoutPricing(product, { discountCode: input.discountCode, orderBump: input.orderBump });

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
  metadata.fee = String(applicationFee(pricing.totalCents));

  if (env.paypalDemo) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({ metadata, amountCents: pricing.totalCents, currency: product.currency, email });
    await fulfilCheckoutSession(session, 'paypal_demo');
    const ent = await EntitlementModel.findOne({ buyerEmail: email, productId: product.id });
    return { url: demoSuccessUrl('product', ent?.accessToken) };
  }
  if (!env.paypalConfigured) throw new AppError(503, 'paypal_unconfigured', 'PayPal is not configured');
  const payeeEmail = await getPayPalPayee(creatorId);
  if (!payeeEmail) throw new AppError(409, 'paypal_not_ready', 'This creator has not connected PayPal');

  const { url } = await startPayPalOrder({
    creatorId,
    kind: 'product',
    metadata,
    amountCents: pricing.totalCents,
    currency: product.currency,
    email: input.email,
    description: product.title,
    brandName: profile.displayName || profile.username,
    payeeEmail,
    cancelUrl: `${env.APP_URL}/${input.username}/product/${input.slug}`,
  });
  return { url };
}

/** PayPal checkout for a course. Returns a redirect URL (approval or demo success). */
export async function createPayPalCourseCheckout(input: CheckoutInput): Promise<{ url: string }> {
  const profile = await CreatorProfileModel.findOne({ username: input.username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const creatorId = String(profile.userId);
  const course = await CourseModel.findOne({ creatorId, slug: input.slug, status: 'published' });
  if (!course) throw AppError.notFound('Course not found');
  if (course.priceCents <= 0) throw AppError.badRequest('This course is free; use enroll instead');

  const metadata: Record<string, string> = {
    itemType: 'course',
    courseId: course.id,
    creatorId,
    source: input.source ?? '',
    fee: String(applicationFee(course.priceCents)),
    ...(input.name ? { buyerName: input.name } : {}),
  };

  if (env.paypalDemo) {
    const { fulfilCheckoutSession } = await import('./fulfilment.service');
    const email = (input.email || DEMO_BUYER_EMAIL).toLowerCase();
    const session = demoSession({ metadata, amountCents: course.priceCents, currency: course.currency, email });
    await fulfilCheckoutSession(session, 'paypal_demo');
    const enr = await EnrollmentModel.findOne({ buyerEmail: email, courseId: course.id });
    return { url: demoSuccessUrl('course', enr?.accessToken) };
  }
  if (!env.paypalConfigured) throw new AppError(503, 'paypal_unconfigured', 'PayPal is not configured');
  const payeeEmail = await getPayPalPayee(creatorId);
  if (!payeeEmail) throw new AppError(409, 'paypal_not_ready', 'This creator has not connected PayPal');

  const { url } = await startPayPalOrder({
    creatorId,
    kind: 'course',
    metadata,
    amountCents: course.priceCents,
    currency: course.currency,
    email: input.email,
    description: course.title,
    brandName: profile.displayName || profile.username,
    payeeEmail,
    cancelUrl: `${env.APP_URL}/${input.username}`,
  });
  return { url };
}

export async function createBookingCheckoutSession(input: {
  creatorId: string;
  bookingId: string;
  title: string;
  priceCents: number;
  currency: string;
  email: string;
  username: string;
  provider?: 'stripe' | 'paypal';
}) {
  const fee = applicationFee(input.priceCents);

  // PayPal path (real or demo) — booking confirms on capture (or instantly in demo).
  if (input.provider === 'paypal') {
    const metadata = { itemType: 'booking', bookingId: input.bookingId, creatorId: input.creatorId, fee: String(fee) };
    if (env.paypalDemo) {
      const { confirmBookingFromSession } = await import('../bookings/bookings.service');
      const session = demoSession({ metadata, amountCents: input.priceCents, currency: input.currency, email: input.email });
      await confirmBookingFromSession(session, 'paypal_demo');
      return { url: demoSuccessUrl('booking'), sessionId: session.id };
    }
    if (!env.paypalConfigured) throw new AppError(503, 'paypal_unconfigured', 'PayPal is not configured');
    const payeeEmail = await getPayPalPayee(input.creatorId);
    if (!payeeEmail) throw new AppError(409, 'paypal_not_ready', 'This creator has not connected PayPal');
    const { url, paypalOrderId } = await startPayPalOrder({
      creatorId: input.creatorId,
      kind: 'booking',
      metadata,
      amountCents: input.priceCents,
      currency: input.currency,
      email: input.email,
      description: input.title,
      payeeEmail,
      cancelUrl: `${env.APP_URL}/${input.username}`,
    });
    return { url, sessionId: paypalOrderId };
  }

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
    throw new AppError(
      409,
      'payments_not_ready',
      'This creator has not finished Stripe setup yet. Ask them to connect Stripe in Settings → Payments.',
    );
  }
  const connectedAccountId = await getConnectedAccountId(input.creatorId);
  if (!connectedAccountId) throw new AppError(409, 'payments_not_ready', 'Creator has no payout account');

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: stripeSuccessUrl(input.username, 'booking'),
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

export async function createWebinarCheckoutSession(input: {
  creatorId: string;
  registrationId: string;
  title: string;
  priceCents: number;
  currency: string;
  email: string;
  username: string;
  provider?: 'stripe' | 'paypal';
}) {
  const fee = applicationFee(input.priceCents);

  if (input.provider === 'paypal') {
    const metadata = { itemType: 'webinar', registrationId: input.registrationId, creatorId: input.creatorId, fee: String(fee) };
    if (env.paypalDemo) {
      const { confirmWebinarFromSession } = await import('../webinars/webinars.service');
      const { WebinarRegistrationModel } = await import('../../models/Webinar');
      const session = demoSession({ metadata, amountCents: input.priceCents, currency: input.currency, email: input.email });
      await confirmWebinarFromSession(session, 'paypal_demo');
      const reg = await WebinarRegistrationModel.findById(input.registrationId).select('manageToken');
      return { url: demoSuccessUrl('webinar', reg?.manageToken), sessionId: session.id };
    }
    if (!env.paypalConfigured) throw new AppError(503, 'paypal_unconfigured', 'PayPal is not configured');
    const payeeEmail = await getPayPalPayee(input.creatorId);
    if (!payeeEmail) throw new AppError(409, 'paypal_not_ready', 'This creator has not connected PayPal');
    const { url, paypalOrderId } = await startPayPalOrder({
      creatorId: input.creatorId,
      kind: 'webinar',
      metadata,
      amountCents: input.priceCents,
      currency: input.currency,
      email: input.email,
      description: input.title,
      payeeEmail,
      cancelUrl: `${env.APP_URL}/${input.username}`,
    });
    return { url, sessionId: paypalOrderId };
  }

  if (env.demoCheckout) {
    const { confirmWebinarFromSession } = await import('../webinars/webinars.service');
    const { WebinarRegistrationModel } = await import('../../models/Webinar');
    const session = demoSession({
      metadata: { itemType: 'webinar', registrationId: input.registrationId, creatorId: input.creatorId, fee: String(fee) },
      amountCents: input.priceCents,
      currency: input.currency,
      email: input.email,
    });
    await confirmWebinarFromSession(session, 'acct_demo');
    const reg = await WebinarRegistrationModel.findById(input.registrationId).select('manageToken');
    return { url: demoSuccessUrl('webinar', reg?.manageToken), sessionId: session.id };
  }

  const stripe = requireStripe();
  if (!(await canAcceptPayments(input.creatorId))) {
    throw AppError.badRequest('This creator has not finished payment setup yet.');
  }
  const connectedAccountId = await getConnectedAccountId(input.creatorId);
  if (!connectedAccountId) throw AppError.badRequest('Creator has no payout account');

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: stripeSuccessUrl(input.username, 'webinar'),
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
      metadata: { itemType: 'webinar', registrationId: input.registrationId, creatorId: input.creatorId, fee: String(fee) },
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
    throw new AppError(
      409,
      'payments_not_ready',
      'This creator has not finished Stripe setup yet. Ask them to connect Stripe in Settings → Payments.',
    );
  }
  const connectedAccountId = await getConnectedAccountId(creatorId);
  if (!connectedAccountId) throw new AppError(409, 'payments_not_ready', 'Creator has no payout account');

  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: stripeSuccessUrl(input.username, 'course'),
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

/**
 * Fulfil a completed Stripe Checkout session on the success page (local dev
 * fallback when webhooks aren't forwarded). Idempotent via fulfilCheckoutSession.
 */
export async function completeCheckoutSession(input: { sessionId: string; username: string }) {
  if (env.demoCheckout) {
    throw AppError.badRequest('Checkout completion is not used in demo mode');
  }

  const profile = await CreatorProfileModel.findOne({ username: input.username.toLowerCase() });
  if (!profile) throw AppError.notFound('Creator not found');

  const connectedAccountId = await getConnectedAccountId(String(profile.userId));
  if (!connectedAccountId) throw AppError.notFound('Creator payment account not found');

  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, { stripeAccount: connectedAccountId });

  if (session.payment_status !== 'paid') {
    throw AppError.badRequest('Payment has not completed yet');
  }

  const { fulfilCheckoutSession } = await import('./fulfilment.service');
  await fulfilCheckoutSession(session, connectedAccountId);

  const itemType = session.metadata?.itemType ?? 'product';
  const buyerEmail =
    session.customer_details?.email?.toLowerCase() || session.customer_email?.toLowerCase();

  if (itemType === 'booking') {
    const { BookingModel } = await import('../../models/Booking');
    const booking = await BookingModel.findById(session.metadata?.bookingId);
    return { kind: 'booking' as const, token: booking?.manageToken, fulfilled: true };
  }

  if (itemType === 'webinar') {
    const { WebinarRegistrationModel } = await import('../../models/Webinar');
    const reg = await WebinarRegistrationModel.findById(session.metadata?.registrationId);
    return { kind: 'webinar' as const, token: reg?.manageToken, fulfilled: true };
  }

  if (itemType === 'course') {
    const courseId = session.metadata?.courseId;
    const enrollment = buyerEmail && courseId
      ? await EnrollmentModel.findOne({ buyerEmail, courseId })
      : null;
    return { kind: 'course' as const, token: enrollment?.accessToken, fulfilled: true };
  }

  if (itemType === 'membership' || itemType === 'payment_plan') {
    const productId = session.metadata?.productId;
    const entitlement = buyerEmail && productId
      ? await EntitlementModel.findOne({ buyerEmail, productId })
      : null;
    return { kind: itemType as 'membership' | 'payment_plan', token: entitlement?.accessToken, fulfilled: true };
  }

  const productId = session.metadata?.productId;
  const entitlement = buyerEmail && productId
    ? await EntitlementModel.findOne({ buyerEmail, productId })
    : null;
  return { kind: 'product' as const, token: entitlement?.accessToken, fulfilled: true };
}
