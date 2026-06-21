import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { LeadModel, type LeadDoc } from '../../models/Lead';
import { OrderModel } from '../../models/Order';
import { EntitlementModel } from '../../models/Entitlement';
import { EnrollmentModel } from '../../models/Enrollment';
import { BookingModel, BookingTypeModel } from '../../models/Booking';
import { ProductModel } from '../../models/Product';
import { CourseModel, CourseLessonModel } from '../../models/Course';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { recordAudit } from '../../lib/audit';
import { triggerFlows } from '../flows/flows.service';

/** Split a free-text full name into first/last for the contact record. */
function splitName(name?: string): { firstName: string; lastName: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Aggregate paid-order counts + total spend per buyer email for a creator.
 * Returns a map keyed by (lowercased) email so the contacts list can surface
 * real Purchases / Spent figures instead of zeros.
 */
async function orderStatsByEmail(
  creatorId: string,
  emails: string[],
): Promise<Map<string, { purchases: number; spentCents: number }>> {
  const map = new Map<string, { purchases: number; spentCents: number }>();
  if (emails.length === 0) return map;
  const rows = await OrderModel.aggregate<{ _id: string; purchases: number; spentCents: number }>([
    { $match: { creatorId: new Types.ObjectId(creatorId), status: 'paid', buyerEmail: { $in: emails } } },
    { $group: { _id: '$buyerEmail', purchases: { $sum: 1 }, spentCents: { $sum: '$amountCents' } } },
  ]);
  for (const r of rows) map.set(r._id, { purchases: r.purchases, spentCents: r.spentCents });
  return map;
}

interface CaptureInput {
  username: string;
  email: string;
  firstName?: string;
  source?: 'storefront' | 'product' | 'checkout' | 'other';
  utm?: { source?: string; medium?: string; campaign?: string };
  consent?: boolean;
  tags?: string[];
}

function publicLead(l: LeadDoc) {
  return {
    id: l.id,
    email: l.email,
    firstName: l.firstName,
    lastName: l.get('lastName') ?? '',
    phone: l.get('phone') ?? '',
    source: l.source,
    tags: l.tags,
    isCustomer: l.isCustomer,
    unsubscribed: Boolean(l.unsubscribedAt),
    createdAt: l.get('createdAt'),
  };
}

const MAX_CONTACTS = 5000;

/** Manually add a single contact from the dashboard. Deduped per tenant by email. */
export async function createContact(
  creatorId: string,
  input: { email: string; firstName?: string; lastName?: string; phone?: string },
) {
  const existing = await LeadModel.findOne({ creatorId, email: input.email });
  if (existing) {
    if (input.firstName) existing.firstName = input.firstName;
    if (input.lastName) existing.set('lastName', input.lastName);
    if (input.phone) existing.set('phone', input.phone);
    await existing.save();
    return { lead: publicLead(existing), created: false };
  }
  const count = await LeadModel.countDocuments({ creatorId });
  if (count >= MAX_CONTACTS) throw AppError.badRequest(`Contact limit of ${MAX_CONTACTS} reached`);

  const lead = await LeadModel.create({
    creatorId,
    email: input.email,
    firstName: input.firstName ?? '',
    lastName: input.lastName ?? '',
    phone: input.phone ?? '',
    source: 'other',
    consent: false,
  });
  recordAudit({ action: 'lead.created', actorType: 'user', actorId: creatorId, creatorId });
  return { lead: publicLead(lead), created: true };
}

/** Bulk-import contacts from a parsed CSV. Upserts per email; enforces the tenant cap. */
export async function importContacts(
  creatorId: string,
  rows: { email: string; firstName?: string; lastName?: string; phone?: string }[],
) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let count = await LeadModel.countDocuments({ creatorId });

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      skipped += 1;
      continue;
    }
    const existing = await LeadModel.findOne({ creatorId, email });
    if (existing) {
      if (row.firstName) existing.firstName = row.firstName;
      if (row.lastName) existing.set('lastName', row.lastName);
      if (row.phone) existing.set('phone', row.phone);
      await existing.save();
      updated += 1;
      continue;
    }
    if (count >= MAX_CONTACTS) {
      skipped += 1;
      continue;
    }
    await LeadModel.create({
      creatorId,
      email,
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      phone: row.phone ?? '',
      source: 'import',
      consent: false,
    });
    created += 1;
    count += 1;
  }
  recordAudit({ action: 'lead.imported', actorType: 'user', actorId: creatorId, creatorId, metadata: { created, updated, skipped } });
  return { created, updated, skipped };
}

/**
 * Capture a lead from a public storefront. Deduped per tenant by email — a
 * repeat submission updates fields (name, tags, utm) rather than creating a
 * duplicate. Returns whether the contact was newly created.
 */
export async function captureLead(input: CaptureInput): Promise<{ created: boolean }> {
  const profile = await CreatorProfileModel.findOne({ username: input.username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const creatorId = String(profile.userId);

  const existing = await LeadModel.findOne({ creatorId, email: input.email });
  if (existing) {
    if (input.firstName && !existing.firstName) existing.firstName = input.firstName;
    if (input.tags?.length) existing.tags = Array.from(new Set([...existing.tags, ...input.tags]));
    if (input.utm) {
      const prev = existing.utm ?? { source: '', medium: '', campaign: '' };
      existing.utm = {
        source: input.utm.source ?? prev.source,
        medium: input.utm.medium ?? prev.medium,
        campaign: input.utm.campaign ?? prev.campaign,
      };
    }
    await existing.save();
    return { created: false };
  }

  await LeadModel.create({
    creatorId,
    email: input.email,
    firstName: input.firstName ?? '',
    source: input.source ?? 'storefront',
    utm: input.utm ?? {},
    consent: input.consent ?? false,
    tags: input.tags ?? [],
  });
  recordAudit({ action: 'lead.captured', actorType: 'anonymous', creatorId, metadata: { source: input.source } });
  await triggerFlows(creatorId, input.email, 'lead').catch(() => {});
  return { created: true };
}

/**
 * Upsert a lead when a buyer purchases, flagging them as a customer. Captures
 * the buyer's name (from checkout) onto the contact — both on first insert and
 * as a backfill for a contact that was captured as a lead before buying.
 */
export async function upsertCustomerLead(creatorId: string, email: string, name?: string): Promise<void> {
  const normalized = email.toLowerCase();
  const { firstName, lastName } = splitName(name);
  await LeadModel.updateOne(
    { creatorId, email: normalized },
    {
      $set: { isCustomer: true },
      $setOnInsert: { source: 'checkout', consent: true, optInStatus: 'confirmed', firstName, lastName },
    },
    { upsert: true },
  );
  // Backfill the name onto a pre-existing contact that has none yet.
  if (firstName || lastName) {
    await LeadModel.updateOne(
      { creatorId, email: normalized, firstName: '' },
      { $set: { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) } },
    );
  }
}

export async function listLeads(creatorId: string, opts: { customersOnly?: boolean } = {}) {
  const filter: Record<string, unknown> = { creatorId };
  if (opts.customersOnly) filter.isCustomer = true;
  const leads = await LeadModel.find(filter).sort({ createdAt: -1 }).limit(500);
  const stats = await orderStatsByEmail(creatorId, leads.map((l) => l.email));
  return leads.map((l) => ({
    ...publicLead(l),
    ...(stats.get(l.email) ?? { purchases: 0, spentCents: 0 }),
  }));
}

export async function leadStats(creatorId: string) {
  const [total, customers, subscribers] = await Promise.all([
    LeadModel.countDocuments({ creatorId }),
    LeadModel.countDocuments({ creatorId, isCustomer: true }),
    LeadModel.countDocuments({ creatorId, unsubscribedAt: { $exists: false } }),
  ]);
  return { total, customers, subscribers };
}

const MONTH_KEY = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Last-12-months paid-spend timeline for the customer detail mini chart. */
function buildMonthlySpend(paid: { amountCents: number; when: Date }[]) {
  const now = new Date();
  const buckets = new Map<string, { spentCents: number; orders: number }>();
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = MONTH_KEY(d);
    keys.push(k);
    buckets.set(k, { spentCents: 0, orders: 0 });
  }
  for (const o of paid) {
    const b = buckets.get(MONTH_KEY(o.when));
    if (b) { b.spentCents += o.amountCents; b.orders += 1; }
  }
  return keys.map((k) => ({ month: k, ...buckets.get(k)! }));
}

/**
 * Full per-customer profile + commerce analytics for one contact: orders,
 * lifetime spend, owned products/courses, bookings, and a 12-month spend
 * timeline. Keyed by the contact's lead id but aggregated by their email.
 */
export async function getCustomerDetail(creatorId: string, leadId: string) {
  const lead = await LeadModel.findOne({ _id: leadId, creatorId });
  if (!lead) throw AppError.notFound('Customer not found');
  const email = lead.email.toLowerCase();

  const [orders, entitlements, enrollments, bookings] = await Promise.all([
    OrderModel.find({ creatorId, buyerEmail: email }).sort({ createdAt: -1 }),
    EntitlementModel.find({ creatorId, buyerEmail: email }).sort({ createdAt: -1 }),
    EnrollmentModel.find({ creatorId, buyerEmail: email }).sort({ createdAt: -1 }),
    BookingModel.find({ creatorId, buyerEmail: email }).sort({ startAt: -1 }),
  ]);

  // Resolve referenced product / course / booking-type titles in bulk.
  const productIds = [...new Set([...orders.map((o) => String(o.productId)), ...entitlements.map((e) => String(e.productId))])];
  const courseIds = [...new Set(enrollments.map((e) => String(e.courseId)))];
  const btIds = [...new Set(bookings.map((b) => String(b.bookingTypeId)))];
  const [products, courses, bts] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }),
    CourseModel.find({ _id: { $in: courseIds } }),
    BookingTypeModel.find({ _id: { $in: btIds } }),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const btTitle = new Map(bts.map((bt) => [bt.id, bt.title]));
  const lessonCounts = new Map<string, number>();
  await Promise.all(
    courses.map(async (c) => lessonCounts.set(c.id, await CourseLessonModel.countDocuments({ courseId: c.id }))),
  );

  const paid = orders.filter((o) => o.status === 'paid');
  const refunded = orders.filter((o) => o.status === 'refunded');
  const spentCents = paid.reduce((s, o) => s + o.amountCents, 0);
  const refundedCents = refunded.reduce((s, o) => s + o.amountCents, 0);
  const paidWhen = paid
    .map((o) => (o.paidAt ?? (o.get('createdAt') as Date)))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    contact: {
      id: lead.id,
      email,
      firstName: lead.firstName,
      lastName: lead.get('lastName') ?? '',
      phone: lead.get('phone') ?? '',
      source: lead.source,
      tags: lead.tags,
      isCustomer: lead.isCustomer,
      unsubscribed: Boolean(lead.unsubscribedAt),
      consent: lead.consent,
      optInStatus: lead.optInStatus,
      utm: { source: lead.utm?.source ?? '', medium: lead.utm?.medium ?? '', campaign: lead.utm?.campaign ?? '' },
      createdAt: lead.get('createdAt'),
    },
    summary: {
      paidOrders: paid.length,
      totalOrders: orders.length,
      spentCents,
      refundedCents,
      netCents: spentCents - refundedCents,
      aovCents: paid.length ? Math.round(spentCents / paid.length) : 0,
      firstPurchaseAt: paidWhen[0] ?? null,
      lastPurchaseAt: paidWhen[paidWhen.length - 1] ?? null,
      currency: paid[0]?.currency ?? 'usd',
      productsOwned: entitlements.filter((e) => !e.revokedAt).length,
      coursesOwned: enrollments.filter((e) => !e.revokedAt).length,
      bookings: bookings.length,
    },
    orders: orders.map((o) => ({
      id: o.id,
      productTitle: productMap.get(String(o.productId))?.title ?? 'Product',
      amountCents: o.amountCents,
      currency: o.currency,
      status: o.status,
      fulfilmentStatus: o.get('fulfilmentStatus'),
      source: o.source ?? '',
      discountCode: o.get('discountCode') ?? '',
      createdAt: o.get('createdAt'),
      paidAt: o.paidAt ?? null,
      refundedAt: o.refundedAt ?? null,
    })),
    products: entitlements.map((e) => {
      const p = productMap.get(String(e.productId));
      return {
        id: e.id,
        title: p?.title ?? 'Product',
        coverImageUrl: p?.coverImageUrl ?? '',
        downloadCount: e.downloadCount,
        lastAccessedAt: e.lastAccessedAt ?? null,
        grantedAt: e.get('grantedAt') ?? e.get('createdAt'),
        revoked: Boolean(e.revokedAt),
      };
    }),
    courses: enrollments.map((e) => {
      const c = courseMap.get(String(e.courseId));
      return {
        id: e.id,
        title: c?.title ?? 'Course',
        coverImageUrl: c?.coverImageUrl ?? '',
        completed: e.completedLessonIds.length,
        total: lessonCounts.get(String(e.courseId)) ?? 0,
        revoked: Boolean(e.revokedAt),
      };
    }),
    bookings: bookings.map((b) => ({
      id: b.id,
      title: btTitle.get(String(b.bookingTypeId)) ?? 'Session',
      startAt: b.startAt,
      timezone: b.get('timezone') || 'UTC',
      status: b.status,
      meetingUrl: b.get('meetingUrl') || '',
      upcoming: b.startAt.getTime() > Date.now(),
    })),
    monthly: buildMonthlySpend(paid.map((o) => ({ amountCents: o.amountCents, when: o.paidAt ?? (o.get('createdAt') as Date) }))),
  };
}
