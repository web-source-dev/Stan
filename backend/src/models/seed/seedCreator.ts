import crypto from 'node:crypto';
import { Types } from 'mongoose';

import { AnalyticsEventModel } from '../AnalyticsEvent';
import { AuditLogModel } from '../AuditLog';
import { BookingModel, BookingTypeModel } from '../Booking';
import { BroadcastModel } from '../Broadcast';
import { CourseLessonModel, CourseModel, CourseModuleModel } from '../Course';
import { CreatorProfileModel } from '../CreatorProfile';
import { EnrollmentModel } from '../Enrollment';
import { EntitlementModel } from '../Entitlement';
import { EmailFlowModel } from '../EmailFlow';
import { AutoDMRuleModel } from '../AutoDMRule';
import { LandingPageModel } from '../LandingPage';
import { LeadModel } from '../Lead';
import { OrderModel } from '../Order';
import { PaymentAccountModel } from '../PaymentAccount';
import { ProductModel } from '../Product';
import { ReferralModel } from '../Referral';
import { StorefrontConfigModel } from '../StorefrontConfig';
import { SubscriptionModel } from '../Subscription';

import {
  AVATARS,
  BOOKING_TITLES,
  CATEGORIES,
  COVER_IMAGES,
  COURSE_TITLES,
  LANDING_HEADLINES,
  PRODUCT_TITLES,
  THEME_PRESETS,
  daysAgo,
  hoursFromNow,
  pick,
  pickN,
  randInt,
  randomEmail,
  randomName,
  slugify,
  standardWeeklyWindows,
} from './helpers';

export interface SeedCreatorOptions {
  username: string;
  displayName: string;
  published: boolean;
  /** Rich demo store (Maya-style) vs lighter random store. */
  tier: 'full' | 'random';
}

export interface SeedCreatorResult {
  username: string;
  products: number;
  leads: number;
  orders: number;
  landingPages: number;
}

function defaultBlocks() {
  return [
    { id: 'blk-header', type: 'header', visible: true, config: { align: 'center', avatarShape: 'circle', banner: 'gradient', bannerHeight: 128, showCategory: true, showBio: true, showSocials: true } },
    { id: 'blk-featured', type: 'featured', visible: true, config: { headline: 'Start here' } },
    { id: 'blk-products', type: 'product', visible: true, config: { title: 'Digital products', layout: 'card', showImage: true, showPrice: true, showDescription: true } },
    { id: 'blk-course', type: 'course', visible: true, config: { title: 'Courses', layout: 'card', showImage: true } },
    { id: 'blk-booking', type: 'booking', visible: true, config: { title: 'Book a call', layout: 'list', showImage: false } },
    { id: 'blk-lead', type: 'leadMagnet', visible: true, config: { title: 'Free resources', layout: 'list', showImage: false } },
    { id: 'blk-links', type: 'links', visible: true, config: { layout: 'pills' } },
    { id: 'blk-email', type: 'emailCapture', visible: true, config: { heading: 'Stay in the loop', buttonLabel: 'Subscribe' } },
  ];
}

/** Seed a complete creator storefront + CRM data for one user. */
export async function seedCreatorStore(
  creatorId: Types.ObjectId,
  opts: SeedCreatorOptions,
): Promise<SeedCreatorResult> {
  const theme = pick(THEME_PRESETS);
  const category = pick(CATEGORIES);
  const avatarUrl = pick(AVATARS);

  await CreatorProfileModel.create({
    userId: creatorId,
    username: opts.username,
    slug: opts.username,
    displayName: opts.displayName,
    category,
    bio: opts.tier === 'full'
      ? 'Templates, courses, and 1:1 coaching for creators building their first digital product.'
      : `${opts.displayName} shares digital products, resources, and coaching for their community.`,
    avatarUrl,
    socialLinks: opts.published
      ? [
          { platform: 'instagram', url: `https://instagram.com/${opts.username}` },
          { platform: 'website', url: `https://${opts.username}.example.com` },
        ]
      : [],
    primaryCta: opts.published ? pick(['shop', 'book', 'subscribe', 'lead'] as const) : 'none',
    published: opts.published,
    publishedAt: opts.published ? daysAgo(randInt(3, 30)) : undefined,
  });

  if (opts.published) {
    await StorefrontConfigModel.create({
      creatorId,
      theme: {
        fontPair: theme.fontPair,
        buttonStyle: 'solid',
        cardStyle: 'shadow',
        background: theme.background,
        accent: theme.accent,
        accent2: theme.accent2,
        backgroundStyle: 'mesh',
      },
      blocks: defaultBlocks(),
      seo: {
        title: `${opts.displayName} — Digital Products`,
        description: `Shop digital products, courses, and book sessions with ${opts.displayName}.`,
        ogImageUrl: '',
      },
    });

    await PaymentAccountModel.create({
      creatorId,
      provider: 'stripe',
      onboardingStatus: 'not_started',
    });
  }

  const productCount = opts.tier === 'full' ? 2 : randInt(2, 4);
  const productTitles = opts.tier === 'full'
    ? ['Creator Notion Starter Pack', '30-Day Launch Checklist']
    : pickN(PRODUCT_TITLES, productCount);

  const products = await ProductModel.create(
    productTitles.map((title, i) => {
      const isLeadMagnet = i === productTitles.length - 1 && (opts.tier === 'full' || Math.random() > 0.5);
      const priceCents = isLeadMagnet ? 0 : randInt(19, 99) * 100;
      const slug = slugify(title);
      return {
        creatorId,
        type: isLeadMagnet ? 'lead_magnet' : 'digital',
        title,
        slug,
        shortDescription: isLeadMagnet
          ? 'Free resource to help you get started.'
          : 'Everything you need in one downloadable pack.',
        description: `${title} — built for creators who want to ship faster.`,
        priceCents: opts.tier === 'full' && i === 0 ? 2900 : priceCents,
        currency: 'usd',
        coverImageUrl: pick(COVER_IMAGES),
        assets: [{
          publicId: `seed/${opts.username}/${slug}`,
          resourceType: 'raw',
          filename: `${slug}.zip`,
          bytes: randInt(256, 2048) * 1024,
          format: isLeadMagnet ? 'pdf' : 'zip',
        }],
        ctaLabel: isLeadMagnet ? 'Download free' : 'Get access',
        thankYouMessage: 'Thanks for your purchase!',
        status: 'published',
        visibility: 'public',
        salesCount: randInt(5, 120),
        grossCents: priceCents * randInt(5, 80),
      };
    }),
  );

  let courseId: Types.ObjectId | null = null;
  let lessonIds: Types.ObjectId[] = [];

  if (opts.tier === 'full' || Math.random() > 0.35) {
    const courseTitle = opts.tier === 'full' ? 'Launch Your First Digital Product' : pick(COURSE_TITLES);
    const course = await CourseModel.create({
      creatorId,
      title: courseTitle,
      slug: slugify(courseTitle),
      shortDescription: 'A practical course to help you launch and sell.',
      description: 'Step-by-step lessons from idea to first sale.',
      priceCents: opts.tier === 'full' ? 9900 : randInt(49, 149) * 100,
      currency: 'usd',
      coverImageUrl: pick(COVER_IMAGES),
      status: 'published',
      enrollmentCount: randInt(3, 40),
      grossCents: randInt(500, 25000) * 100,
    });
    courseId = course._id;

    const [mod1, mod2] = await CourseModuleModel.create([
      { courseId, creatorId, title: 'Getting started', sortOrder: 0 },
      { courseId, creatorId, title: 'Going live', sortOrder: 1 },
    ]);

    const lessons = await CourseLessonModel.create([
      { courseId, moduleId: mod1._id, creatorId, title: 'Welcome', type: 'video', preview: true, sortOrder: 0, durationSec: 300, videoPublicId: `seed/${opts.username}/welcome` },
      { courseId, moduleId: mod1._id, creatorId, title: 'Core concepts', type: 'text', sortOrder: 1, textContent: 'Focus on one audience and one outcome.' },
      { courseId, moduleId: mod2._id, creatorId, title: 'Launch day', type: 'video', sortOrder: 0, durationSec: 720, videoPublicId: `seed/${opts.username}/launch` },
    ]);
    lessonIds = lessons.map((l) => l._id);
  }

  let bookingTypeId: Types.ObjectId | null = null;
  if (opts.published && (opts.tier === 'full' || Math.random() > 0.4)) {
    const btTitle = opts.tier === 'full' ? '30-min Strategy Call' : pick(BOOKING_TITLES);
    const durationMin = opts.tier === 'full' ? 30 : pick([30, 45, 60]);
    const bt = await BookingTypeModel.create({
      creatorId,
      title: btTitle,
      slug: opts.tier === 'full' ? '30-min-strategy-call' : slugify(btTitle),
      description: 'Review your goals and next steps together.',
      durationMin,
      priceCents: opts.tier === 'full' ? 7500 : randInt(50, 150) * 100,
      currency: 'usd',
      timezone: 'America/New_York',
      weeklyWindows: standardWeeklyWindows(),
      minNoticeMin: 120,
      maxHorizonDays: 60,
      meetingProvider: 'manual',
      meetingUrl: `https://meet.example.com/${opts.username}`,
      intakeQuestions: ['What are you working on?', 'What would make this session a win?'],
      status: 'published',
    });
    bookingTypeId = bt._id;
  }

  const leadCount = opts.tier === 'full' ? 3 : randInt(6, 14);
  const leads: { email: string; firstName: string; lastName: string; isCustomer: boolean }[] = [];

  if (opts.tier === 'full') {
    leads.push(
      { email: 'jordan@example.com', firstName: 'Jordan', lastName: 'Lee', isCustomer: true },
      { email: 'sam@example.com', firstName: 'Sam', lastName: 'Park', isCustomer: false },
      { email: 'taylor@example.com', firstName: 'Taylor', lastName: 'Reed', isCustomer: true },
    );
  } else {
    for (let i = 0; i < leadCount; i++) {
      const { firstName, lastName } = randomName();
      leads.push({
        email: randomEmail(firstName, lastName),
        firstName,
        lastName,
        isCustomer: Math.random() > 0.55,
      });
    }
  }

  await LeadModel.create(
    leads.map((l) => ({
      creatorId,
      email: l.email,
      firstName: l.firstName,
      lastName: l.lastName,
      source: pick(['storefront', 'product', 'checkout', 'import'] as const),
      utm: { source: pick(['instagram', 'tiktok', 'google', 'newsletter']), medium: pick(['bio', 'ad', 'email']), campaign: pick(['spring', 'launch', 'bf', '']) },
      tags: pickN(['newsletter', 'lead-magnet', 'vip', 'waitlist'], randInt(0, 2)),
      consent: true,
      optInStatus: 'confirmed' as const,
      isCustomer: l.isCustomer,
    })),
  );

  const orders = [];
  const customerLeads = leads.filter((l) => l.isCustomer);
  const orderTargets = opts.tier === 'full' ? customerLeads : pickN(customerLeads, Math.min(customerLeads.length, randInt(2, 6)));

  for (const buyer of orderTargets) {
    const product = pick(products.filter((p) => p.priceCents > 0)) ?? products[0];
    const paidAt = daysAgo(randInt(1, 28));
    const order = await OrderModel.create({
      creatorId,
      productId: product._id,
      buyerEmail: buyer.email,
      amountCents: product.priceCents,
      currency: 'usd',
      applicationFeeCents: Math.round(product.priceCents * 0.1),
      stripeCheckoutSessionId: `cs_seed_${opts.username}_${slugify(buyer.email)}`,
      stripePaymentIntentId: `pi_seed_${opts.username}_${randInt(1000, 9999)}`,
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      source: pick(['storefront', 'landing', 'direct']),
      paidAt,
    });
    orders.push(order);

    await EntitlementModel.create({
      creatorId,
      productId: product._id,
      orderId: order._id,
      buyerEmail: buyer.email,
      type: 'download',
      accessToken: crypto.randomBytes(32).toString('base64url'),
      grantedAt: paidAt,
      lastAccessedAt: daysAgo(randInt(0, 10)),
      downloadCount: randInt(1, 4),
    });
  }

  if (courseId && orderTargets.length > 0) {
    const buyer = pick(orderTargets);
    const courseOrder = await OrderModel.create({
      creatorId,
      productId: courseId,
      buyerEmail: buyer.email,
      amountCents: opts.tier === 'full' ? 9900 : randInt(49, 149) * 100,
      currency: 'usd',
      applicationFeeCents: 990,
      stripeCheckoutSessionId: `cs_seed_${opts.username}_course`,
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      paidAt: daysAgo(randInt(1, 20)),
    });
    orders.push(courseOrder);

    await EnrollmentModel.create({
      creatorId,
      courseId,
      orderId: courseOrder._id,
      buyerEmail: buyer.email,
      accessToken: crypto.randomBytes(32).toString('base64url'),
      completedLessonIds: lessonIds.slice(0, randInt(0, lessonIds.length)),
      lastLessonId: lessonIds[0],
      enrolledAt: daysAgo(randInt(1, 14)),
      lastAccessedAt: daysAgo(randInt(0, 5)),
    });
  }

  if (bookingTypeId && orderTargets.length > 0) {
    const buyer = pick(orderTargets);
    const startAt = hoursFromNow(randInt(24, 120));
    await BookingModel.create({
      creatorId,
      bookingTypeId,
      buyerEmail: buyer.email,
      buyerName: `${buyer.firstName} ${buyer.lastName}`,
      intakeAnswers: [
        { question: 'What are you working on?', answer: pick(['Launching a course', 'Growing my list', 'Pricing my offer']) },
        { question: 'What would make this session a win?', answer: pick(['Clear next steps', 'Confidence on pricing', 'A launch plan']) },
      ],
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60 * 1000),
      timezone: 'America/New_York',
      status: 'confirmed',
      meetingUrl: `https://meet.example.com/${opts.username}`,
      manageToken: crypto.randomBytes(24).toString('base64url'),
    });
  }

  if (opts.published) {
    const anonIds = Array.from({ length: 8 }, (_, i) => `anon_${opts.username}_${i}`);
    const eventDays = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));
    const analyticsRows: {
      creatorId: typeof creatorId;
      type: 'view' | 'product_click' | 'checkout_start' | 'lead_submit';
      anonId: string;
      path: string;
      createdAt: Date;
      productId?: typeof products[0]['_id'];
    }[] = [];

    for (let i = 0; i < eventDays.length; i++) {
      const day = eventDays[i];
      const views = randInt(2, 12);
      for (let v = 0; v < views; v++) {
        analyticsRows.push({
          creatorId,
          type: 'view',
          anonId: pick(anonIds),
          path: `/${opts.username}`,
          createdAt: day,
        });
      }
      if (i % 3 === 0) {
        analyticsRows.push({
          creatorId,
          type: 'product_click',
          productId: pick(products)._id,
          anonId: pick(anonIds),
          path: `/${opts.username}/${products[0].slug}`,
          createdAt: day,
        });
      }
      if (i % 4 === 1) {
        analyticsRows.push({
          creatorId,
          type: 'checkout_start',
          anonId: pick(anonIds),
          path: `/${opts.username}/${products[0].slug}`,
          createdAt: day,
        });
      }
      if (i % 5 === 2) {
        analyticsRows.push({
          creatorId,
          type: 'lead_submit',
          anonId: pick(anonIds),
          path: `/${opts.username}`,
          createdAt: day,
        });
      }
    }
    await AnalyticsEventModel.insertMany(analyticsRows);
  }

  const landingCount = opts.tier === 'full' ? 1 : randInt(1, 3);
  const landingSlugs = opts.tier === 'full'
    ? ['black-friday']
    : pickN(['launch-deal', 'vip-offer', 'early-bird', 'bundle', 'flash-sale'], landingCount);

  await LandingPageModel.create(
    landingSlugs.map((slug, i) => ({
      creatorId,
      title: slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug,
      headline: pick(LANDING_HEADLINES),
      body: `Exclusive offer from ${opts.displayName}. Available for a limited time.`,
      productId: products[i % products.length]._id,
      ctaLabel: pick(['Claim the deal', 'Get access', 'Grab it now']),
      published: opts.published && (i === 0 || Math.random() > 0.3),
      views: randInt(10, 200),
    })),
  );

  if (opts.published) {
    await BroadcastModel.create([
      {
        creatorId,
        subject: `New drop from ${opts.displayName}`,
        bodyHtml: '<p>Just released something new — check it out on my store.</p>',
        bodyText: 'Just released something new — check it out on my store.',
        segment: 'all_leads',
        status: 'sent',
        recipientCount: randInt(20, 150),
        sentAt: daysAgo(randInt(3, 30)),
      },
      {
        creatorId,
        subject: 'Coming soon 👀',
        bodyHtml: '<p>Reply if you want early access.</p>',
        bodyText: 'Reply if you want early access.',
        segment: 'subscribers',
        status: 'draft',
      },
    ]);

    await EmailFlowModel.create([
      {
        creatorId,
        name: 'New subscriber welcome',
        trigger: 'lead',
        enabled: true,
        steps: [
          { dayOffset: 0, subject: "You're on the list! 🌟", body: `Thanks for subscribing to ${opts.displayName}'s updates.` },
          { dayOffset: 3, subject: 'A quick tip to get started', body: 'Here is where most people begin…' },
        ],
      },
      {
        creatorId,
        name: 'Post-purchase welcome',
        trigger: 'purchase',
        enabled: true,
        steps: [
          { dayOffset: 0, subject: 'Thanks for your purchase! 🎉', body: 'Here is how to get the most out of it…' },
          { dayOffset: 2, subject: 'Pro tip', body: 'Try this first — it makes everything click.' },
        ],
      },
    ]);

    await ReferralModel.create({
      creatorId,
      code: `${opts.username}${randInt(10, 99)}`,
      commissionRate: pick([0.1, 0.15, 0.2]),
      clicks: randInt(5, 80),
      signups: randInt(1, 15),
      referredEmails: pickN(leads.map((l) => l.email), randInt(0, 3)),
      earningsCents: randInt(500, 12000),
    });

    await AutoDMRuleModel.create({
      creatorId,
      platform: 'instagram',
      keyword: pick(['GUIDE', 'LINK', 'FREE', 'SHOP']),
      reply: pick(["Here's the link you asked for! 👇", 'Sent! Check your DMs.', 'Grab it here 👇']),
      linkUrl: `https://${opts.username}.example.com/offer`,
      enabled: true,
      triggeredCount: randInt(3, 40),
    });
  }

  await SubscriptionModel.create({
    userId: creatorId,
    plan: pick(['monthly', 'yearly'] as const),
    status: pick(['trialing', 'active'] as const),
    trialEndsAt: hoursFromNow(randInt(7, 21) * 24),
  });

  await AuditLogModel.create({
    action: 'product.published',
    actorId: creatorId,
    actorType: 'user',
    creatorId,
    targetType: 'product',
    targetId: products[0]._id.toString(),
    metadata: { title: products[0].title },
    createdAt: daysAgo(randInt(5, 20)),
  });

  return {
    username: opts.username,
    products: products.length,
    leads: leads.length,
    orders: orders.length,
    landingPages: landingSlugs.length,
  };
}
