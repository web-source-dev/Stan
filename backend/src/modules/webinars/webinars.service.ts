import { DateTime } from 'luxon';
import type Stripe from 'stripe';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { WebinarModel, WebinarRegistrationModel, type WebinarDoc, type WebinarRegistrationDoc } from '../../models/Webinar';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { OrderModel } from '../../models/Order';
import { uniqueSlug } from '../../lib/slug';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';
import { enqueueEmail, enqueueJob } from '../../lib/jobs';
import { registerJobHandler } from '../../lib/jobRunner';
import { notifyCreatorNewSale, resolveCreatorBranding } from '../../lib/creatorNotifications';
import { upsertCustomerLead } from '../leads/leads.service';
import { triggerFlows } from '../flows/flows.service';

type SlotInput = { startsAt: string | Date };

function mapEmailFlows(w: WebinarDoc) {
  return w.emailFlows.map((s) => ({
    id: String(s._id),
    dayOffset: s.dayOffset,
    subject: s.subject,
    body: s.body,
    enabled: s.enabled,
  }));
}

function mapCustomFields(w: WebinarDoc) {
  return w.customFields.map((f) => ({
    id: String(f._id),
    label: f.label,
    type: f.type as 'text' | 'textarea' | 'phone',
    required: f.required,
  }));
}

function mapSlots(w: WebinarDoc) {
  return w.slots.map((s) => ({
    id: String(s._id),
    startsAt: s.startsAt.toISOString(),
  }));
}

function publicWebinar(w: WebinarDoc) {
  return {
    id: w.id,
    title: w.title,
    slug: w.slug,
    shortDescription: w.shortDescription,
    description: w.description,
    priceCents: w.priceCents,
    currency: w.currency,
    discountPriceCents: w.discountPriceCents,
    discountEnabled: w.discountEnabled,
    coverImageUrl: w.coverImageUrl,
    coverPublicId: w.coverPublicId,
    thumbnailStyle: w.thumbnailStyle,
    thumbnailButtonLabel: w.thumbnailButtonLabel,
    bottomTitle: w.bottomTitle,
    ctaLabel: w.ctaLabel,
    slots: mapSlots(w),
    durationMin: w.durationMin,
    timezone: w.timezone,
    calendarIntegration: w.calendarIntegration,
    capacityPerSlot: w.capacityPerSlot,
    reminderEnabled: w.reminderEnabled,
    reminderHoursBefore: w.reminderHoursBefore,
    emailFlows: mapEmailFlows(w),
    customFields: mapCustomFields(w),
    confirmSubject: w.confirmSubject,
    confirmBody: w.confirmBody,
    meetingUrl: w.meetingUrl ?? '',
    replayUrl: w.replayUrl ?? '',
    status: w.status,
    registrationCount: w.registrationCount,
    grossCents: w.grossCents,
    createdAt: w.get('createdAt'),
  };
}

const WEBINAR_PATCH_FIELDS = [
  'title', 'shortDescription', 'description', 'priceCents', 'coverImageUrl', 'coverPublicId',
  'discountPriceCents', 'discountEnabled',
  'thumbnailStyle', 'thumbnailButtonLabel', 'bottomTitle', 'ctaLabel',
  'durationMin', 'timezone', 'calendarIntegration', 'capacityPerSlot',
  'reminderEnabled', 'reminderHoursBefore',
  'confirmSubject', 'confirmBody', 'meetingUrl', 'replayUrl',
] as const;

async function owned(creatorId: string, id: string): Promise<WebinarDoc> {
  const webinar = await WebinarModel.findOne({ _id: id, creatorId });
  if (!webinar) throw AppError.notFound('Webinar not found');
  return webinar;
}

function normalizeSlots(slots: SlotInput[] | undefined) {
  if (!slots) return undefined;
  return slots.map((s) => ({ startsAt: new Date(s.startsAt) }));
}

export async function createWebinar(creatorId: string, input: Record<string, unknown>) {
  const title = String(input.title || 'Join Me at the Webinar');
  const slug = await uniqueSlug(title, async (c) => Boolean(await WebinarModel.exists({ creatorId, slug: c })));
  const webinar = await WebinarModel.create({
    creatorId,
    slug,
    title,
    shortDescription: (input.shortDescription as string) ?? '',
    description: (input.description as string) ?? '',
    priceCents: (input.priceCents as number) ?? 999,
    coverImageUrl: (input.coverImageUrl as string) ?? '',
    coverPublicId: (input.coverPublicId as string) ?? '',
    thumbnailStyle: (input.thumbnailStyle as string) ?? 'callout',
    thumbnailButtonLabel: (input.thumbnailButtonLabel as string) ?? 'Claim Your Spot',
    bottomTitle: (input.bottomTitle as string) ?? 'Join Me & Friends',
    ctaLabel: (input.ctaLabel as string) ?? 'Secure Your Spot',
    discountPriceCents: (input.discountPriceCents as number) ?? 0,
    discountEnabled: (input.discountEnabled as boolean) ?? false,
    durationMin: (input.durationMin as number) ?? 30,
    timezone: (input.timezone as string) ?? 'Asia/Shanghai',
    calendarIntegration: (input.calendarIntegration as string) ?? 'default',
    capacityPerSlot: (input.capacityPerSlot as number) ?? 50,
    reminderEnabled: (input.reminderEnabled as boolean) ?? true,
    reminderHoursBefore: (input.reminderHoursBefore as number) ?? 24,
    confirmSubject: (input.confirmSubject as string) ?? 'Your webinar spot is confirmed',
    confirmBody: (input.confirmBody as string) ?? '',
    slots: normalizeSlots(input.slots as SlotInput[]) ?? [],
    emailFlows: (input.emailFlows as Record<string, unknown>[]) ?? [],
    customFields: (input.customFields as Record<string, unknown>[]) ?? [],
  });
  recordAudit({ action: 'webinar.created', actorId: creatorId, actorType: 'user', creatorId, targetType: 'webinar', targetId: webinar.id });
  return publicWebinar(webinar);
}

export async function listWebinars(creatorId: string) {
  const webinars = await WebinarModel.find({ creatorId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  return webinars.map(publicWebinar);
}

export async function getWebinar(creatorId: string, id: string) {
  const webinar = await owned(creatorId, id);
  return publicWebinar(webinar);
}

export async function updateWebinar(creatorId: string, id: string, patch: Record<string, unknown>) {
  const webinar = await owned(creatorId, id);
  for (const f of WEBINAR_PATCH_FIELDS) {
    if (patch[f] !== undefined) (webinar as unknown as Record<string, unknown>)[f] = patch[f];
  }
  if (patch.slots !== undefined) {
    (webinar as unknown as Record<string, unknown>).slots = normalizeSlots(patch.slots as SlotInput[]) ?? [];
  }
  if (patch.emailFlows !== undefined) {
    (webinar as unknown as Record<string, unknown>).emailFlows = (patch.emailFlows as Record<string, unknown>[]).map((s) => ({
      dayOffset: Number(s.dayOffset ?? 0),
      subject: String(s.subject ?? ''),
      body: String(s.body ?? ''),
      enabled: Boolean(s.enabled ?? true),
    }));
  }
  if (patch.customFields !== undefined) {
    (webinar as unknown as Record<string, unknown>).customFields = (patch.customFields as Record<string, unknown>[]).map((f) => ({
      label: String(f.label ?? ''),
      type: (f.type as 'text' | 'textarea' | 'phone') ?? 'text',
      required: Boolean(f.required ?? false),
    }));
  }
  await webinar.save();
  return publicWebinar(webinar);
}

export async function publishWebinar(creatorId: string, id: string) {
  const webinar = await owned(creatorId, id);
  if (webinar.priceCents > 0 && !(await canAcceptPayments(creatorId))) {
    throw new AppError(409, 'payments_not_ready', 'Connect a payout account before publishing a paid webinar');
  }
  webinar.status = 'published';
  await webinar.save();
  recordAudit({ action: 'webinar.published', actorId: creatorId, actorType: 'user', creatorId, targetType: 'webinar', targetId: webinar.id });
  return publicWebinar(webinar);
}

export async function setWebinarStatus(creatorId: string, id: string, status: 'draft' | 'archived') {
  const webinar = await owned(creatorId, id);
  webinar.status = status;
  await webinar.save();
  return publicWebinar(webinar);
}

function effectivePriceCents(w: WebinarDoc): number {
  if (w.discountEnabled && w.discountPriceCents > 0) return w.discountPriceCents;
  return w.priceCents;
}

function whenText(startAt: Date, zone: string): string {
  return DateTime.fromJSDate(startAt, { zone: zone || 'UTC' }).toFormat("ccc, LLL d 'at' h:mm a ZZZZ");
}

async function publishedWebinar(username: string, slug: string) {
  const profile = await CreatorProfileModel.findOne({ username: username.toLowerCase() });
  if (!profile) throw AppError.notFound('Webinar not found');
  const webinar = await WebinarModel.findOne({ creatorId: profile.userId, slug: slug.toLowerCase(), status: 'published' });
  if (!webinar) throw AppError.notFound('Webinar not found');
  return { profile, webinar, creatorId: String(profile.userId) };
}

function validateCustomFieldAnswers(
  webinar: WebinarDoc,
  values: Record<string, string> = {},
): void {
  for (const field of webinar.customFields) {
    const key = String(field._id);
    const val = (values[key] ?? values[field.label] ?? '').trim();
    if (field.required && !val) throw AppError.badRequest(`Please fill in: ${field.label}`);
  }
}

async function slotSeatCounts(webinarId: Types.ObjectId, slotIds: Types.ObjectId[]) {
  if (!slotIds.length) return new Map<string, number>();
  const rows = await WebinarRegistrationModel.aggregate([
    {
      $match: {
        webinarId,
        slotId: { $in: slotIds },
        status: { $in: ['confirmed', 'pending_payment'] },
      },
    },
    { $group: { _id: '$slotId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count as number]));
}

/** Published webinars for a storefront. */
export async function listPublicWebinars(creatorId: string) {
  const items = await WebinarModel.find({ creatorId, status: 'published' }).sort({ createdAt: -1 });
  return items.map((w) => ({
    id: w.id,
    title: w.title,
    slug: w.slug,
    shortDescription: w.shortDescription,
    priceCents: effectivePriceCents(w),
    currency: w.currency,
    coverImageUrl: w.coverImageUrl,
    ctaLabel: w.ctaLabel || 'Secure Your Spot',
    durationMin: w.durationMin,
    type: 'webinar' as const,
  }));
}

/** Upcoming slots with remaining capacity for the public registration page. */
export async function getWebinarAvailability(username: string, slug: string) {
  const { webinar } = await publishedWebinar(username, slug);
  const now = new Date();
  const upcoming = webinar.slots.filter((s) => s.startsAt.getTime() > now.getTime());
  const counts = await slotSeatCounts(webinar._id, upcoming.map((s) => s._id as Types.ObjectId));

  return {
    id: webinar.id,
    title: webinar.title,
    slug: webinar.slug,
    shortDescription: webinar.shortDescription,
    description: webinar.description,
    priceCents: effectivePriceCents(webinar),
    currency: webinar.currency,
    durationMin: webinar.durationMin,
    timezone: webinar.timezone,
    customFields: mapCustomFields(webinar),
    slots: upcoming
      .map((s) => {
        const taken = counts.get(String(s._id)) ?? 0;
        const seatsLeft = Math.max(0, webinar.capacityPerSlot - taken);
        return {
          id: String(s._id),
          startsAt: s.startsAt.toISOString(),
          seatsLeft,
        };
      })
      .filter((s) => s.seatsLeft > 0),
  };
}

/** Register for a webinar slot (free confirms immediately; paid returns checkout URL). */
export async function createWebinarRegistration(input: {
  username: string;
  slug: string;
  slotId: string;
  email: string;
  name?: string;
  customFieldValues?: Record<string, string>;
  provider?: 'stripe' | 'paypal';
}) {
  const { webinar, creatorId } = await publishedWebinar(input.username, input.slug);
  validateCustomFieldAnswers(webinar, input.customFieldValues);

  const slot = webinar.slots.find((s) => String(s._id) === input.slotId);
  if (!slot) throw AppError.badRequest('Please pick a valid session time');
  if (slot.startsAt.getTime() <= Date.now()) throw AppError.conflict('That session has already started');

  const counts = await slotSeatCounts(webinar._id, [slot._id as Types.ObjectId]);
  const taken = counts.get(String(slot._id)) ?? 0;
  if (taken >= webinar.capacityPerSlot) throw AppError.conflict('That session is full');

  const paid = effectivePriceCents(webinar) > 0;
  const buyerEmail = input.email.toLowerCase().trim();

  let registration: WebinarRegistrationDoc;
  try {
    registration = await WebinarRegistrationModel.create({
      creatorId,
      webinarId: webinar._id,
      slotId: slot._id,
      buyerEmail,
      buyerName: input.name ?? '',
      customFieldAnswers: input.customFieldValues ?? {},
      startsAt: slot.startsAt,
      timezone: webinar.timezone,
      status: paid ? 'pending_payment' : 'confirmed',
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw AppError.conflict('You are already registered for this session');
    }
    throw err;
  }

  // Race-safe capacity guard (same pattern as bookings).
  const seatRank = await WebinarRegistrationModel.countDocuments({
    webinarId: webinar._id,
    slotId: slot._id,
    status: { $in: ['confirmed', 'pending_payment'] },
    _id: { $lte: registration._id },
  });
  if (seatRank > webinar.capacityPerSlot) {
    await WebinarRegistrationModel.deleteOne({ _id: registration._id });
    throw AppError.conflict('That session is full');
  }

  if (!paid) {
    await WebinarModel.updateOne({ _id: webinar._id }, { $inc: { registrationCount: 1 } });
    await sendWebinarConfirmation(registration, webinar);
    await upsertCustomerLead(creatorId, buyerEmail, input.name).catch(() => {});
    recordAudit({
      action: 'webinar.registered_free',
      actorType: 'anonymous',
      creatorId,
      targetType: 'webinar',
      targetId: webinar.id,
    });
    return { status: 'confirmed' as const, manageToken: registration.manageToken };
  }

  const { createWebinarCheckoutSession } = await import('../checkout/checkout.service');
  const checkout = await createWebinarCheckoutSession({
    creatorId,
    registrationId: registration.id,
    title: webinar.title,
    priceCents: effectivePriceCents(webinar),
    currency: webinar.currency,
    email: buyerEmail,
    username: input.username,
    provider: input.provider ?? 'stripe',
  });
  registration.stripeCheckoutSessionId = checkout.sessionId;
  await registration.save();
  return { status: 'pending_payment' as const, checkoutUrl: checkout.url };
}

export async function sendWebinarConfirmation(registration: WebinarRegistrationDoc, webinar: WebinarDoc) {
  const branding = await resolveCreatorBranding(String(registration.creatorId)).catch(() => ({
    displayName: 'CreatorStore',
    username: '',
    replyTo: undefined as string | undefined,
  }));
  const portalUrl = branding.username
    ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(registration.buyerEmail)}`
    : undefined;
  const manageUrl = `${env.APP_URL}/webinar/${registration.manageToken}`;
  const wt = whenText(registration.startsAt, registration.timezone);
  const meetingUrl = webinar.meetingUrl || undefined;
  const mailOpts = { fromName: branding.displayName, replyTo: branding.replyTo };

  if (webinar.confirmSubject?.trim() || webinar.confirmBody?.trim()) {
    const personalise = (t: string) =>
      t
        .replace(/\[Webinar Title\]/g, webinar.title)
        .replace(/\[Product Name\]/g, webinar.title)
        .replace(/\[When\]/g, wt)
        .replace(/\[Meeting Link\]/g, meetingUrl ?? '')
        .replace(/\[Manage Link\]/g, manageUrl)
        .replace(/\[My Username\]/g, branding.username ?? '');
    const subject = personalise(webinar.confirmSubject?.trim() || `Webinar confirmed: ${webinar.title}`);
    const bodyText = personalise(
      webinar.confirmBody?.trim() ||
        `You're registered for ${webinar.title}.\n\n${wt}` +
          (meetingUrl ? `\n\nJoin link: ${meetingUrl}` : '') +
          `\n\nManage your registration: ${manageUrl}`,
    );
    await enqueueEmail(
      registration.buyerEmail,
      'broadcast',
      {
        subject,
        bodyText: bodyText + (portalUrl ? `\n\nView all your purchases: ${portalUrl}` : ''),
        fromName: branding.displayName,
      },
      mailOpts,
    );
  } else {
    await enqueueEmail(
      registration.buyerEmail,
      'booking_confirmation',
      {
        title: webinar.title,
        whenText: wt,
        meetingUrl,
        manageUrl,
        portalUrl,
        creatorName: branding.displayName,
      },
      mailOpts,
    );
  }

  if (webinar.reminderEnabled) await scheduleWebinarReminder(registration, webinar);
  await triggerFlows(String(registration.creatorId), registration.buyerEmail, 'purchase').catch(() => {});
}

const HOUR_MS = 60 * 60 * 1000;

export async function scheduleWebinarReminder(registration: WebinarRegistrationDoc, webinar: WebinarDoc) {
  const start = registration.startsAt.getTime();
  const offsetHours = Math.max(1, webinar.reminderHoursBefore ?? 24);
  const runAt = new Date(start - offsetHours * HOUR_MS);
  if (runAt.getTime() <= Date.now()) return;
  await enqueueJob(
    'webinar_reminder',
    { registrationId: registration.id },
    { runAt, dedupeKey: `webinar_reminder:${registration.id}` },
  ).catch((err) => {
    logger.warn({ err, registrationId: registration.id }, 'Failed to schedule webinar reminder');
  });
}

async function processWebinarReminder(payload: Record<string, unknown>): Promise<void> {
  const registration = await WebinarRegistrationModel.findById(String(payload.registrationId ?? ''));
  if (!registration || registration.status !== 'confirmed' || registration.startsAt.getTime() <= Date.now()) return;
  const webinar = await WebinarModel.findById(registration.webinarId);
  if (!webinar) return;
  const mins = Math.round((registration.startsAt.getTime() - Date.now()) / 60000);
  const startsInText =
    mins >= 90 ? `in about ${Math.round(mins / 60)} hours` : mins >= 45 ? 'in about an hour' : `in ${Math.max(1, mins)} minutes`;
  const branding = await resolveCreatorBranding(String(registration.creatorId)).catch(() => ({
    displayName: 'CreatorStore',
    username: '',
    replyTo: undefined as string | undefined,
  }));
  const portalUrl = branding.username
    ? `${env.APP_URL}/${branding.username}/account?email=${encodeURIComponent(registration.buyerEmail)}`
    : undefined;
  await enqueueEmail(
    registration.buyerEmail,
    'booking_reminder',
    {
      title: webinar.title,
      whenText: whenText(registration.startsAt, registration.timezone),
      startsInText,
      meetingUrl: webinar.meetingUrl || undefined,
      manageUrl: `${env.APP_URL}/webinar/${registration.manageToken}`,
      portalUrl,
      creatorName: branding.displayName,
    },
    { fromName: branding.displayName, replyTo: branding.replyTo },
  );
}

export function registerWebinarJobs(): void {
  registerJobHandler('webinar_reminder', processWebinarReminder);
}

/** Confirm a paid registration from checkout (webhook / success-page fulfilment). */
export async function confirmWebinarFromSession(session: Stripe.Checkout.Session, accountId?: string): Promise<void> {
  const registrationId = session.metadata?.registrationId;
  if (!registrationId) return;
  const registration = await WebinarRegistrationModel.findById(registrationId);
  if (!registration || registration.status === 'confirmed') return;

  const webinar = await WebinarModel.findById(registration.webinarId);
  if (!webinar) return;

  let order = await OrderModel.findOne({ stripeCheckoutSessionId: session.id });
  if (!order) {
    order = await OrderModel.create({
      creatorId: registration.creatorId,
      productId: registration.webinarId,
      buyerEmail: registration.buyerEmail,
      buyerName: registration.buyerName ?? '',
      amountCents: session.amount_total ?? effectivePriceCents(webinar),
      currency: session.currency ?? webinar.currency,
      applicationFeeCents: typeof session.metadata?.fee === 'string' ? Number(session.metadata.fee) : 0,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      stripeAccountId: accountId,
      paymentProvider: accountId?.startsWith('paypal') ? 'paypal' : 'stripe',
      status: 'paid',
      fulfilmentStatus: 'fulfilled',
      paidAt: new Date(),
    });
  }

  registration.status = 'confirmed';
  registration.set('orderId', order._id);
  await registration.save();
  await WebinarModel.updateOne({ _id: webinar._id }, { $inc: { registrationCount: 1, grossCents: order.amountCents } });

  await sendWebinarConfirmation(registration, webinar);
  await upsertCustomerLead(String(registration.creatorId), registration.buyerEmail, registration.buyerName).catch(() => {});

  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: order.currency.toUpperCase(),
  }).format(order.amountCents / 100);
  await notifyCreatorNewSale(String(registration.creatorId), {
    itemTitle: webinar.title,
    itemKind: 'product',
    amount,
    buyerEmail: registration.buyerEmail,
    buyerName: registration.buyerName,
    orderId: order.id,
  }).catch(() => {});

  recordAudit({
    action: 'webinar.confirmed_paid',
    actorType: 'system',
    creatorId: String(registration.creatorId),
    targetType: 'webinar',
    targetId: webinar.id,
  });
}

export async function getRegistrationByToken(token: string) {
  const registration = await WebinarRegistrationModel.findOne({ manageToken: token });
  if (!registration) throw AppError.notFound('Registration not found');
  const webinar = await WebinarModel.findById(registration.webinarId);
  if (!webinar) throw AppError.notFound('Webinar not found');

  const now = Date.now();
  const start = registration.startsAt.getTime();
  let displayStatus: string = registration.status;
  if (registration.status === 'confirmed') {
    if (start <= now && now < start + webinar.durationMin * 60_000) displayStatus = 'in progress';
    else if (now >= start + webinar.durationMin * 60_000) displayStatus = 'ended';
  }

  return {
    id: registration.id,
    title: webinar.title,
    startsAt: registration.startsAt.toISOString(),
    timezone: registration.timezone,
    durationMin: webinar.durationMin,
    status: registration.status,
    displayStatus,
    meetingUrl: registration.status === 'confirmed' ? webinar.meetingUrl || '' : '',
    replayUrl: webinar.replayUrl || '',
    whenText: whenText(registration.startsAt, registration.timezone),
  };
}

export async function cancelRegistrationByToken(token: string) {
  const registration = await WebinarRegistrationModel.findOne({ manageToken: token });
  if (!registration || registration.status === 'cancelled') throw AppError.notFound('Registration not found');
  const wasConfirmed = registration.status === 'confirmed';
  registration.status = 'cancelled';
  registration.cancelledAt = new Date();
  await registration.save();
  if (wasConfirmed) {
    await WebinarModel.updateOne({ _id: registration.webinarId }, { $inc: { registrationCount: -1 } });
  }
  return { ok: true };
}

export async function cancelRegistrationByCheckoutSession(sessionId: string) {
  const registration = await WebinarRegistrationModel.findOne({ stripeCheckoutSessionId: sessionId });
  if (!registration || registration.status === 'cancelled') return;
  registration.status = 'cancelled';
  registration.cancelledAt = new Date();
  await registration.save();
}

export async function listWebinarRegistrations(creatorId: string) {
  const rows = await WebinarRegistrationModel.find({ creatorId })
    .sort({ startsAt: -1 })
    .limit(500);
  const webinarIds = [...new Set(rows.map((r) => String(r.webinarId)))];
  const webinars = await WebinarModel.find({ _id: { $in: webinarIds } }, 'title slug').lean();
  const titles = new Map(webinars.map((w) => [String(w._id), w.title]));

  return rows.map((r) => ({
    id: r.id,
    webinarId: String(r.webinarId),
    webinarTitle: titles.get(String(r.webinarId)) ?? 'Webinar',
    buyerEmail: r.buyerEmail,
    buyerName: r.buyerName ?? '',
    startsAt: r.startsAt.toISOString(),
    status: r.status,
  }));
}
