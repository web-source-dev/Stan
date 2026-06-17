import { AppError } from '../../utils/AppError';
import { UserModel } from '../../models/User';
import { CreatorProfileModel, type CreatorProfileDoc } from '../../models/CreatorProfile';
import { StorefrontConfigModel } from '../../models/StorefrontConfig';
import { RESERVED_USERNAMES } from './creator.validators';
import { recordAudit } from '../../lib/audit';
import { listPublicProducts } from '../products/products.service';
import { listPublicCourses } from '../courses/courses.service';
import { listPublicBookingTypes } from '../bookings/bookings.service';

export function isReserved(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}

export async function isUsernameAvailable(username: string, exceptUserId?: string): Promise<boolean> {
  if (isReserved(username)) return false;
  const existing = await CreatorProfileModel.findOne({ username }).select('userId');
  if (!existing) return true;
  return Boolean(exceptUserId) && existing.userId.toString() === exceptUserId;
}

function publicProfile(profile: CreatorProfileDoc) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    category: profile.category,
    bio: profile.bio,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    socialLinks: profile.socialLinks,
    analytics: profile.analytics,
    address: profile.address,
    primaryCta: profile.primaryCta,
    published: profile.published,
  };
}

/**
 * Public-safe profile for anonymous storefront visitors. Deliberately omits PII
 * (phone, postal address) that the owner-facing `publicProfile` includes.
 */
function storefrontProfile(profile: CreatorProfileDoc) {
  const { phone: _phone, address: _address, ...rest } = publicProfile(profile);
  return rest;
}

export async function getOwnProfile(userId: string) {
  const profile = await CreatorProfileModel.findOne({ userId });
  return profile ? publicProfile(profile) : null;
}

/**
 * Complete onboarding: claim a username and create the profile + storefront
 * config. Idempotent-ish: if a profile already exists, the username is locked
 * and only other fields are updated.
 */
export async function completeOnboarding(
  userId: string,
  input: {
    username: string;
    displayName: string;
    category?: string;
    bio?: string;
    avatarPublicId?: string;
    avatarUrl?: string;
    socialLinks?: { platform: string; url: string }[];
    primaryCta?: 'shop' | 'book' | 'subscribe' | 'lead' | 'none';
  },
) {
  const existing = await CreatorProfileModel.findOne({ userId });

  if (!existing && !(await isUsernameAvailable(input.username, userId))) {
    throw AppError.conflict('That username is taken');
  }

  let profile = existing;
  if (profile) {
    // Username is immutable here once claimed; ignore changes to it.
    Object.assign(profile, {
      displayName: input.displayName,
      category: input.category ?? profile.category,
      bio: input.bio ?? profile.bio,
      avatarPublicId: input.avatarPublicId ?? profile.avatarPublicId,
      avatarUrl: input.avatarUrl ?? profile.avatarUrl,
      socialLinks: input.socialLinks ?? profile.socialLinks,
      primaryCta: input.primaryCta ?? profile.primaryCta,
    });
    await profile.save();
  } else {
    try {
      profile = await CreatorProfileModel.create({
        userId,
        username: input.username,
        displayName: input.displayName,
        category: input.category ?? '',
        bio: input.bio ?? '',
        avatarPublicId: input.avatarPublicId ?? '',
        avatarUrl: input.avatarUrl ?? '',
        socialLinks: input.socialLinks ?? [],
        primaryCta: input.primaryCta ?? 'none',
      });
    } catch (err) {
      // Lost the race on the unique username index — return a clean conflict.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        throw AppError.conflict('That username is taken');
      }
      throw err;
    }
    await StorefrontConfigModel.create({ creatorId: userId });
  }

  await UserModel.updateOne(
    { _id: userId, onboardingCompletedAt: { $exists: false } },
    { $set: { onboardingCompletedAt: new Date() } },
  );
  recordAudit({ action: 'creator.onboarding_completed', actorId: userId, actorType: 'user', creatorId: userId });

  return publicProfile(profile);
}

export async function updateProfile(userId: string, patch: Record<string, unknown>) {
  const profile = await CreatorProfileModel.findOne({ userId });
  if (!profile) throw AppError.notFound('Complete onboarding before editing your profile');
  Object.assign(profile, patch);
  await profile.save();
  recordAudit({ action: 'creator.profile_updated', actorId: userId, actorType: 'user', creatorId: userId });
  return publicProfile(profile);
}

export async function getStorefrontConfig(userId: string) {
  let config = await StorefrontConfigModel.findOne({ creatorId: userId });
  if (!config) config = await StorefrontConfigModel.create({ creatorId: userId });
  return config;
}

// Sections that may exist at most once; the four collections render their full
// catalog so slicing fields must be dropped.
const SINGLE_INSTANCE_BLOCKS = new Set(['product', 'course', 'booking', 'leadMagnet', 'links', 'emailCapture']);
const COLLECTION_BLOCKS = new Set(['product', 'course', 'booking', 'leadMagnet']);

/**
 * Guard the persisted storefront against duplicated/missing items: collapse
 * duplicate single-instance sections (e.g. a design template that produced
 * several `product` blocks) to the first, and strip collection slicing
 * (startIndex/maxItems) so a section never hides part of the catalog.
 */
function normalizeBlocks(blocks: unknown): unknown {
  if (!Array.isArray(blocks)) return blocks;
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as Record<string, unknown>;
    const type = typeof b.type === 'string' ? b.type : '';
    if (!type) continue;
    if (SINGLE_INSTANCE_BLOCKS.has(type)) {
      if (seen.has(type)) continue;
      seen.add(type);
    }
    if (COLLECTION_BLOCKS.has(type) && b.config && typeof b.config === 'object') {
      const { startIndex: _s, maxItems: _m, ...rest } = b.config as Record<string, unknown>;
      out.push({ ...b, config: rest });
    } else {
      out.push(b);
    }
  }
  return out;
}

export async function updateStorefrontConfig(userId: string, patch: Record<string, unknown>) {
  const config = await getStorefrontConfig(userId);
  if (patch.theme) Object.assign(config.theme as object, patch.theme as object);
  if (patch.blocks) config.blocks = normalizeBlocks(patch.blocks) as never;
  if (patch.seo) Object.assign(config.seo as object, patch.seo as object);
  await config.save();
  recordAudit({ action: 'creator.storefront_updated', actorId: userId, actorType: 'user', creatorId: userId });
  return config;
}

/** Publish requires a verified email (enforced by middleware) and a profile. */
export async function setPublished(userId: string, published: boolean) {
  const profile = await CreatorProfileModel.findOne({ userId });
  if (!profile) throw AppError.notFound('Complete onboarding before publishing');
  profile.published = published;
  if (published && !profile.publishedAt) profile.publishedAt = new Date();
  await profile.save();
  recordAudit({
    action: published ? 'creator.published' : 'creator.unpublished',
    actorId: userId,
    actorType: 'user',
    creatorId: userId,
  });
  return publicProfile(profile);
}

/** Public storefront read model assembled from profile + storefront config. */
export async function getPublicStorefront(username: string) {
  const profile = await CreatorProfileModel.findOne({ username });
  if (!profile || !profile.published) throw AppError.notFound('Storefront not found');
  const config = await StorefrontConfigModel.findOne({ creatorId: profile.userId });
  const products = await listPublicProducts(String(profile.userId));
  const courses = await listPublicCourses(String(profile.userId));
  const bookingTypes = await listPublicBookingTypes(String(profile.userId));
  return {
    profile: storefrontProfile(profile),
    theme: config?.theme ?? null,
    blocks: (config?.blocks ?? []).filter((b) => b.visible !== false),
    seo: config?.seo ?? null,
    products,
    courses,
    bookingTypes,
  };
}
