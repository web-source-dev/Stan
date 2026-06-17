import { AppError } from '../../utils/AppError';
import { WebinarModel, type WebinarDoc } from '../../models/Webinar';
import { uniqueSlug } from '../../lib/slug';
import { recordAudit } from '../../lib/audit';
import { canAcceptPayments } from '../payments/connect.service';

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
  'confirmSubject', 'confirmBody',
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
