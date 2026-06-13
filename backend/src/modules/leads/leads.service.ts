import { AppError } from '../../utils/AppError';
import { LeadModel, type LeadDoc } from '../../models/Lead';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { recordAudit } from '../../lib/audit';
import { triggerFlows } from '../flows/flows.service';

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

/** Upsert a lead when a buyer purchases, flagging them as a customer. */
export async function upsertCustomerLead(creatorId: string, email: string): Promise<void> {
  await LeadModel.updateOne(
    { creatorId, email },
    {
      $set: { isCustomer: true },
      $setOnInsert: { source: 'checkout', consent: true, optInStatus: 'confirmed' },
    },
    { upsert: true },
  );
}

export async function listLeads(creatorId: string, opts: { customersOnly?: boolean } = {}) {
  const filter: Record<string, unknown> = { creatorId };
  if (opts.customersOnly) filter.isCustomer = true;
  const leads = await LeadModel.find(filter).sort({ createdAt: -1 }).limit(500);
  return leads.map(publicLead);
}

export async function leadStats(creatorId: string) {
  const [total, customers, subscribers] = await Promise.all([
    LeadModel.countDocuments({ creatorId }),
    LeadModel.countDocuments({ creatorId, isCustomer: true }),
    LeadModel.countDocuments({ creatorId, unsubscribedAt: { $exists: false } }),
  ]);
  return { total, customers, subscribers };
}
