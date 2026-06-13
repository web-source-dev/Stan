import crypto from 'node:crypto';
import type { Model } from 'mongoose';

import { connectDb, disconnectDb } from '../../config/db';
import { hashPassword } from '../../lib/password';
import { generateJti, hashToken } from '../../lib/tokens';
import { AnalyticsEventModel } from '../AnalyticsEvent';
import { AuditLogModel } from '../AuditLog';
import { AuthTokenModel } from '../AuthToken';
import { BookingModel, BookingTypeModel } from '../Booking';
import { BroadcastModel } from '../Broadcast';
import { CourseLessonModel, CourseModel, CourseModuleModel } from '../Course';
import { CreatorProfileModel } from '../CreatorProfile';
import { EnrollmentModel } from '../Enrollment';
import { EntitlementModel } from '../Entitlement';
import { JobModel } from '../Job';
import { LeadModel } from '../Lead';
import { OrderModel } from '../Order';
import { PaymentAccountModel } from '../PaymentAccount';
import { ProductModel } from '../Product';
import { RefreshSessionModel } from '../RefreshSession';
import { StorefrontConfigModel } from '../StorefrontConfig';
import { UserModel } from '../User';
import { WebhookEventModel } from '../WebhookEvent';
import { ReferralModel } from '../Referral';
import { EmailFlowModel } from '../EmailFlow';
import { AutoDMRuleModel } from '../AutoDMRule';
import { LandingPageModel } from '../LandingPage';
import { SubscriptionModel } from '../Subscription';

export const SEED_MARKER_EMAIL = 'maya@demo.com';
export const SEED_PASSWORD = 'Password123!';

// Clear via the models themselves so we always hit the correct Mongoose
// collection names (e.g. `creatorprofiles`, not `creator_profiles`).
const SEED_MODELS: Model<any>[] = [
  UserModel, CreatorProfileModel, StorefrontConfigModel, AuthTokenModel, RefreshSessionModel,
  AuditLogModel, WebhookEventModel, JobModel, PaymentAccountModel, ProductModel, OrderModel,
  EntitlementModel, LeadModel, AnalyticsEventModel, BroadcastModel, CourseModel, CourseModuleModel,
  CourseLessonModel, EnrollmentModel, BookingModel, BookingTypeModel, ReferralModel, EmailFlowModel,
  AutoDMRuleModel, LandingPageModel, SubscriptionModel,
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursFromNow(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d;
}

async function clearCollections(): Promise<void> {
  for (const Model of SEED_MODELS) {
    await Model.deleteMany({});
  }
}

export async function runSeed(options: { force?: boolean } = {}): Promise<void> {
  const existing = await UserModel.findOne({ email: SEED_MARKER_EMAIL });
  if (existing && !options.force) {
    // eslint-disable-next-line no-console
    console.log(
      `Seed data already exists (${SEED_MARKER_EMAIL}). Run with --force to wipe and reseed.`,
    );
    return;
  }

  if (options.force) {
    await clearCollections();
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const now = new Date();

  // ---- Users ----
  const [admin, maya, alex] = await UserModel.create([
    {
      email: 'admin@demo.com',
      passwordHash,
      role: 'admin',
      emailVerified: true,
      emailVerifiedAt: daysAgo(30),
      onboardingCompletedAt: daysAgo(30),
      status: 'active',
      lastLoginAt: daysAgo(1),
    },
    {
      email: SEED_MARKER_EMAIL,
      passwordHash,
      role: 'creator',
      emailVerified: true,
      emailVerifiedAt: daysAgo(14),
      onboardingCompletedAt: daysAgo(14),
      status: 'active',
      lastLoginAt: daysAgo(0),
    },
    {
      email: 'alex@demo.com',
      passwordHash,
      role: 'creator',
      emailVerified: true,
      emailVerifiedAt: daysAgo(3),
      status: 'active',
    },
  ]);

  const mayaId = maya._id;
  const alexId = alex._id;

  // ---- Creator profiles ----
  await CreatorProfileModel.create([
    {
      userId: mayaId,
      username: 'maya',
      slug: 'maya',
      displayName: 'Maya Chen',
      category: 'Design & Productivity',
      bio: 'Templates, courses, and 1:1 coaching for creators building their first digital product.',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      socialLinks: [
        { platform: 'instagram', url: 'https://instagram.com/mayachen' },
        { platform: 'youtube', url: 'https://youtube.com/@mayachen' },
        { platform: 'website', url: 'https://mayachen.example.com' },
      ],
      primaryCta: 'shop',
      published: true,
      publishedAt: daysAgo(10),
    },
    {
      userId: alexId,
      username: 'alex',
      displayName: 'Alex Rivera',
      category: 'Fitness',
      bio: 'Workout plans coming soon.',
      primaryCta: 'none',
      published: false,
    },
  ]);

  // ---- Storefront config ----
  await StorefrontConfigModel.create({
    creatorId: mayaId,
    theme: {
      fontPair: 'poppins',
      buttonStyle: 'solid',
      cardStyle: 'shadow',
      background: '#faf5ff',
      accent: '#7c3aed',
      accent2: '#ec4899',
      backgroundStyle: 'mesh',
    },
    blocks: [
      { id: 'blk-header', type: 'header', visible: true, config: { align: 'center', avatarShape: 'circle', banner: 'gradient', bannerHeight: 128, showCategory: true, showBio: true, showSocials: true } },
      { id: 'blk-featured', type: 'featured', visible: true, config: { headline: 'Start here' } },
      { id: 'blk-products', type: 'product', visible: true, config: { title: 'Digital products', layout: 'card', showImage: true, showPrice: true, showDescription: true } },
      { id: 'blk-course', type: 'course', visible: true, config: { title: 'Courses', layout: 'card', showImage: true } },
      { id: 'blk-booking', type: 'booking', visible: true, config: { title: 'Book a call', layout: 'list', showImage: false } },
      { id: 'blk-lead', type: 'leadMagnet', visible: true, config: { title: 'Free resources', layout: 'list', showImage: false } },
      { id: 'blk-links', type: 'links', visible: true, config: { layout: 'pills' } },
      { id: 'blk-email', type: 'emailCapture', visible: true, config: { heading: 'Stay in the loop', buttonLabel: 'Subscribe' } },
    ],
    seo: {
      title: 'Maya Chen — Digital Products & Coaching',
      description: 'Notion templates, a launch course, and 1:1 strategy calls.',
      ogImageUrl: '',
    },
  });

  // ---- Payment account ----
  await PaymentAccountModel.create({
    creatorId: mayaId,
    provider: 'stripe',
    stripeAccountId: 'acct_seed_maya_demo',
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    onboardingStatus: 'complete',
  });

  // ---- Products ----
  const [notionPack, launchChecklist] = await ProductModel.create([
    {
      creatorId: mayaId,
      type: 'digital',
      title: 'Creator Notion Starter Pack',
      slug: 'notion-starter-pack',
      shortDescription: 'Five plug-and-play Notion dashboards for content planning.',
      description:
        'Includes a content calendar, sponsorship tracker, revenue dashboard, launch checklist, and weekly review template.',
      priceCents: 2900,
      currency: 'usd',
      coverImageUrl:
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&h=400&fit=crop',
      assets: [
        {
          publicId: 'seed/notion-pack',
          resourceType: 'raw',
          filename: 'creator-notion-pack.zip',
          bytes: 1_024_000,
          format: 'zip',
        },
      ],
      ctaLabel: 'Get the pack',
      thankYouMessage: 'Thanks! Your download link is on its way.',
      status: 'published',
      visibility: 'public',
      salesCount: 42,
      grossCents: 121_800,
    },
    {
      creatorId: mayaId,
      type: 'lead_magnet',
      title: '30-Day Launch Checklist',
      slug: 'launch-checklist',
      shortDescription: 'Free PDF checklist to ship your first offer.',
      description: 'A step-by-step checklist covering offer validation, pricing, and launch week.',
      priceCents: 0,
      coverImageUrl:
        'https://images.unsplash.com/photo-1434030214721-735b608f0d0f?w=600&h=400&fit=crop',
      assets: [
        {
          publicId: 'seed/launch-checklist',
          resourceType: 'raw',
          filename: '30-day-launch-checklist.pdf',
          bytes: 512_000,
          format: 'pdf',
        },
      ],
      ctaLabel: 'Download free',
      status: 'published',
      visibility: 'public',
      salesCount: 128,
      grossCents: 0,
    },
  ]);

  const notionPackId = notionPack._id;
  const launchChecklistId = launchChecklist._id;

  // ---- Course ----
  const launchCourse = await CourseModel.create({
    creatorId: mayaId,
    title: 'Launch Your First Digital Product',
    slug: 'launch-first-product',
    shortDescription: 'A 4-module course from idea to first sale.',
    description:
      'Learn positioning, pricing, building a simple storefront, and running a lean launch.',
    priceCents: 9900,
    currency: 'usd',
    coverImageUrl:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop',
    status: 'published',
    enrollmentCount: 18,
    grossCents: 178_200,
  });

  const courseId = launchCourse._id;

  const [mod1, mod2] = await CourseModuleModel.create([
    { courseId, creatorId: mayaId, title: 'Foundations', sortOrder: 0 },
    { courseId, creatorId: mayaId, title: 'Launch Week', sortOrder: 1 },
  ]);

  const [lesson1, lesson2, lesson3] = await CourseLessonModel.create([
    {
      courseId,
      moduleId: mod1._id,
      creatorId: mayaId,
      title: 'Welcome & course map',
      type: 'video',
      preview: true,
      sortOrder: 0,
      durationSec: 320,
      videoPublicId: 'seed/course/welcome',
    },
    {
      courseId,
      moduleId: mod1._id,
      creatorId: mayaId,
      title: 'Choosing your first offer',
      type: 'text',
      sortOrder: 1,
      textContent: 'Start narrow: one audience, one painful problem, one outcome.',
    },
    {
      courseId,
      moduleId: mod2._id,
      creatorId: mayaId,
      title: 'Launch day playbook',
      type: 'video',
      sortOrder: 0,
      durationSec: 840,
      videoPublicId: 'seed/course/launch-day',
    },
  ]);

  // ---- Booking type ----
  const strategyCall = await BookingTypeModel.create({
    creatorId: mayaId,
    title: '30-min Strategy Call',
    slug: 'strategy-call',
    description: 'Review your offer, pricing, and launch plan.',
    durationMin: 30,
    priceCents: 7500,
    currency: 'usd',
    timezone: 'America/New_York',
    weeklyWindows: [
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 3, startMinute: 540, endMinute: 720 },
      { weekday: 5, startMinute: 600, endMinute: 780 },
    ],
    minNoticeMin: 1440,
    maxHorizonDays: 21,
    meetingProvider: 'manual',
    meetingUrl: 'https://meet.example.com/maya-strategy',
    intakeQuestions: ['What are you launching?', 'What is your biggest blocker right now?'],
    status: 'published',
  });

  const bookingTypeId = strategyCall._id;

  // ---- Leads ----
  await LeadModel.create([
    {
      creatorId: mayaId,
      email: 'jordan@example.com',
      firstName: 'Jordan',
      source: 'storefront',
      utm: { source: 'instagram', medium: 'bio', campaign: 'spring' },
      tags: ['newsletter'],
      consent: true,
      optInStatus: 'confirmed',
      isCustomer: true,
    },
    {
      creatorId: mayaId,
      email: 'sam@example.com',
      firstName: 'Sam',
      source: 'product',
      tags: ['lead-magnet'],
      consent: true,
      optInStatus: 'confirmed',
    },
    {
      creatorId: mayaId,
      email: 'taylor@example.com',
      firstName: 'Taylor',
      source: 'checkout',
      consent: true,
      optInStatus: 'confirmed',
      isCustomer: true,
    },
  ]);

  // ---- Orders ----
  const [paidOrder, courseOrder, leadMagnetOrder] = await OrderModel.create([
    {
      creatorId: mayaId,
      productId: notionPackId,
      buyerEmail: 'jordan@example.com',
      amountCents: 2900,
      currency: 'usd',
      applicationFeeCents: 290,
      stripeCheckoutSessionId: 'cs_seed_notion_pack_001',
      stripePaymentIntentId: 'pi_seed_notion_pack_001',
      stripeAccountId: 'acct_seed_maya_demo',
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      source: 'storefront',
      campaign: { utm_source: 'instagram' },
      paidAt: daysAgo(5),
    },
    {
      creatorId: mayaId,
      productId: courseId,
      buyerEmail: 'taylor@example.com',
      amountCents: 9900,
      currency: 'usd',
      applicationFeeCents: 990,
      stripeCheckoutSessionId: 'cs_seed_course_001',
      stripePaymentIntentId: 'pi_seed_course_001',
      stripeAccountId: 'acct_seed_maya_demo',
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      paidAt: daysAgo(2),
    },
    {
      creatorId: mayaId,
      productId: launchChecklistId,
      buyerEmail: 'sam@example.com',
      amountCents: 0,
      currency: 'usd',
      stripeCheckoutSessionId: 'cs_seed_lead_magnet_001',
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      source: 'storefront',
      paidAt: daysAgo(7),
    },
  ]);

  const paidOrderId = paidOrder._id;
  const courseOrderId = courseOrder._id;
  const leadMagnetOrderId = leadMagnetOrder._id;

  // ---- Entitlements ----
  await EntitlementModel.create([
    {
      creatorId: mayaId,
      productId: notionPackId,
      orderId: paidOrderId,
      buyerEmail: 'jordan@example.com',
      type: 'download',
      accessToken: crypto.randomBytes(32).toString('base64url'),
      grantedAt: daysAgo(5),
      lastAccessedAt: daysAgo(4),
      downloadCount: 2,
    },
    {
      creatorId: mayaId,
      productId: launchChecklistId,
      orderId: leadMagnetOrderId,
      buyerEmail: 'sam@example.com',
      type: 'download',
      accessToken: crypto.randomBytes(32).toString('base64url'),
      grantedAt: daysAgo(7),
      downloadCount: 1,
    },
  ]);

  // ---- Enrollments ----
  await EnrollmentModel.create({
    creatorId: mayaId,
    courseId,
    orderId: courseOrderId,
    buyerEmail: 'taylor@example.com',
    accessToken: crypto.randomBytes(32).toString('base64url'),
    completedLessonIds: [lesson1._id, lesson2._id],
    lastLessonId: lesson2._id,
    enrolledAt: daysAgo(2),
    lastAccessedAt: daysAgo(1),
  });

  // ---- Bookings ----
  const bookingStart = hoursFromNow(48);
  const bookingEnd = new Date(bookingStart.getTime() + 30 * 60 * 1000);

  await BookingModel.create({
    creatorId: mayaId,
    bookingTypeId,
    buyerEmail: 'jordan@example.com',
    buyerName: 'Jordan Lee',
    intakeAnswers: [
      { question: 'What are you launching?', answer: 'A Notion template shop' },
      { question: 'What is your biggest blocker right now?', answer: 'Pricing confidence' },
    ],
    startAt: bookingStart,
    endAt: bookingEnd,
    timezone: 'America/New_York',
    status: 'confirmed',
    meetingUrl: 'https://meet.example.com/maya-strategy',
    manageToken: crypto.randomBytes(24).toString('base64url'),
  });

  // ---- Analytics events ----
  const anonIds = ['anon_seed_1', 'anon_seed_2', 'anon_seed_3'];
  await AnalyticsEventModel.insertMany([
    { creatorId: mayaId, type: 'view', anonId: anonIds[0], path: '/maya', createdAt: daysAgo(6) },
    { creatorId: mayaId, type: 'view', anonId: anonIds[1], path: '/maya', createdAt: daysAgo(5) },
    {
      creatorId: mayaId,
      type: 'product_click',
      productId: notionPackId,
      anonId: anonIds[0],
      path: '/maya/notion-starter-pack',
      createdAt: daysAgo(5),
    },
    {
      creatorId: mayaId,
      type: 'checkout_start',
      productId: notionPackId,
      anonId: anonIds[0],
      path: '/maya/notion-starter-pack',
      createdAt: daysAgo(5),
    },
    {
      creatorId: mayaId,
      type: 'cta_click',
      anonId: anonIds[2],
      path: '/maya',
      createdAt: daysAgo(3),
    },
    {
      creatorId: mayaId,
      type: 'lead_submit',
      productId: launchChecklistId,
      anonId: anonIds[1],
      path: '/maya/launch-checklist',
      createdAt: daysAgo(7),
    },
  ]);

  // ---- Broadcast ----
  await BroadcastModel.create([
    {
      creatorId: mayaId,
      subject: 'New: Creator Notion Starter Pack',
      bodyHtml: '<p>Just dropped five dashboards to plan content and track revenue.</p>',
      bodyText: 'Just dropped five dashboards to plan content and track revenue.',
      segment: 'all_leads',
      status: 'sent',
      recipientCount: 86,
      sentAt: daysAgo(8),
    },
    {
      creatorId: mayaId,
      subject: 'Launch course early access',
      bodyHtml: '<p>Enrollment opens next week — reply if you want the waitlist price.</p>',
      bodyText: 'Enrollment opens next week — reply if you want the waitlist price.',
      segment: 'subscribers',
      status: 'draft',
    },
  ]);

  // ---- Platform subscription (Billing) ----
  await SubscriptionModel.create({
    userId: mayaId,
    plan: 'monthly',
    status: 'trialing',
    trialEndsAt: hoursFromNow(14 * 24),
  });

  // ---- Referral program ----
  await ReferralModel.create({
    creatorId: mayaId,
    code: 'maya20',
    commissionRate: 0.2,
    clicks: 34,
    signups: 5,
    referredEmails: ['friend1@example.com', 'friend2@example.com'],
    earningsCents: 5800,
  });

  // ---- Email flow (post-purchase drip) ----
  await EmailFlowModel.create({
    creatorId: mayaId,
    name: 'Post-purchase welcome',
    trigger: 'purchase',
    enabled: true,
    steps: [
      { dayOffset: 0, subject: 'Thanks for your purchase! 🎉', body: 'Here is how to get the most out of it…' },
      { dayOffset: 2, subject: 'A quick tip for you', body: 'Most people start with the content calendar — try it first.' },
    ],
  });

  // ---- AutoDM rule ----
  await AutoDMRuleModel.create({
    creatorId: mayaId,
    platform: 'instagram',
    keyword: 'GUIDE',
    reply: "Here's the free guide you asked for! 👇",
    linkUrl: 'https://maya.example.com/guide',
    enabled: true,
    triggeredCount: 12,
  });

  // ---- Landing page (linked to the Notion pack) ----
  await LandingPageModel.create({
    creatorId: mayaId,
    title: 'Black Friday Bundle',
    slug: 'black-friday',
    headline: 'Everything, 50% off — this week only',
    body: 'Grab the Creator Notion Starter Pack with an exclusive discount for my community.',
    productId: notionPackId,
    ctaLabel: 'Claim the deal',
    published: true,
    views: 57,
  });

  // ---- Audit logs ----
  await AuditLogModel.insertMany([
    {
      action: 'user.login',
      actorId: mayaId,
      actorType: 'user',
      creatorId: mayaId,
      ip: '127.0.0.1',
      userAgent: 'seed-script',
      createdAt: daysAgo(0),
    },
    {
      action: 'product.published',
      actorId: mayaId,
      actorType: 'user',
      creatorId: mayaId,
      targetType: 'product',
      targetId: notionPackId.toString(),
      metadata: { title: 'Creator Notion Starter Pack' },
      createdAt: daysAgo(10),
    },
    {
      action: 'order.fulfilled',
      actorType: 'system',
      creatorId: mayaId,
      targetType: 'order',
      targetId: paidOrderId.toString(),
      createdAt: daysAgo(5),
    },
    {
      action: 'admin.seed',
      actorId: admin._id,
      actorType: 'admin',
      metadata: { version: 1 },
      createdAt: now,
    },
  ]);

  // ---- Webhook events ----
  await WebhookEventModel.create([
    {
      provider: 'stripe',
      eventId: 'evt_seed_checkout_completed_001',
      type: 'checkout.session.completed',
      status: 'processed',
      attempts: 1,
      payload: { id: 'cs_seed_notion_pack_001', object: 'checkout.session' },
      processedAt: daysAgo(5),
    },
    {
      provider: 'stripe',
      eventId: 'evt_seed_account_updated_001',
      type: 'account.updated',
      status: 'processed',
      attempts: 1,
      payload: { id: 'acct_seed_maya_demo', charges_enabled: true },
      processedAt: daysAgo(12),
    },
    {
      provider: 'resend',
      eventId: 'evt_seed_email_delivered_001',
      type: 'email.delivered',
      status: 'processed',
      attempts: 1,
      payload: { to: 'jordan@example.com' },
      processedAt: daysAgo(5),
    },
  ]);

  // ---- Jobs ----
  await JobModel.create([
    {
      type: 'send_email',
      payload: { to: 'jordan@example.com', template: 'purchase_confirmation' },
      status: 'completed',
      attempts: 1,
      maxAttempts: 5,
      runAt: daysAgo(5),
      completedAt: daysAgo(5),
    },
    {
      type: 'fulfilment',
      payload: { orderId: paidOrderId.toString() },
      status: 'completed',
      attempts: 1,
      runAt: daysAgo(5),
      completedAt: daysAgo(5),
    },
    {
      type: 'booking_reminder',
      payload: { bookingTypeId: bookingTypeId.toString(), hoursBefore: 24 },
      status: 'pending',
      runAt: hoursFromNow(24),
    },
  ]);

  // ---- Auth token (unused password-reset token for alex) ----
  await AuthTokenModel.create({
    userId: alexId,
    type: 'password_reset',
    tokenHash: hashToken('seed-reset-token-not-valid'),
    expiresAt: hoursFromNow(1),
  });

  // ---- Refresh session (active session for maya) ----
  await RefreshSessionModel.create({
    userId: mayaId,
    jti: generateJti(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: 'seed-script',
    ip: '127.0.0.1',
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Demo accounts (password for all):', SEED_PASSWORD);
  // eslint-disable-next-line no-console
  console.log('  admin@demo.com  — admin');
  // eslint-disable-next-line no-console
  console.log('  maya@demo.com   — creator (published storefront @ /maya)');
  // eslint-disable-next-line no-console
  console.log('  alex@demo.com   — creator (unpublished draft)');
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Seeded entities:');
  // eslint-disable-next-line no-console
  console.log(`  Products: ${notionPack.title}, ${launchChecklist.title}`);
  // eslint-disable-next-line no-console
  console.log(`  Course: ${launchCourse.title} (${lesson1.title}, ${lesson2.title}, ${lesson3.title})`);
  // eslint-disable-next-line no-console
  console.log(`  Booking: ${strategyCall.title}`);
  // eslint-disable-next-line no-console
  console.log('  Referrals (code maya20), Email flow, AutoDM rule, Landing page (/maya/p/black-friday), Trial subscription');
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  try {
    await connectDb();
    await runSeed({ force });
  } finally {
    await disconnectDb();
  }
}

const isMain =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (isMain) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
