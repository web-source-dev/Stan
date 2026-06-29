import type { Model } from 'mongoose';

import { connectDb, disconnectDb } from '../../config/db';
import { hashPassword } from '../../lib/password';
import { generateJti, hashToken } from '../../lib/tokens';
import { AnalyticsEventModel } from '../AnalyticsEvent';
import { AuditLogModel } from '../AuditLog';
import { AuthTokenModel } from '../AuthToken';
import { BookingModel, BookingTypeModel } from '../Booking';
import { BroadcastModel } from '../Broadcast';
import { CheckoutIntentModel } from '../CheckoutIntent';
import { CourseLessonModel, CourseModel, CourseModuleModel } from '../Course';
import { CreatorProfileModel } from '../CreatorProfile';
import { CustomerLoginCodeModel } from '../CustomerLoginCode';
import { EnrollmentModel } from '../Enrollment';
import { EntitlementModel } from '../Entitlement';
import { EmailFlowModel } from '../EmailFlow';
import { AutoDMRuleModel } from '../AutoDMRule';
import { IntegrationModel } from '../Integration';
import { InvoiceModel } from '../Invoice';
import { JobModel } from '../Job';
import { LandingPageModel } from '../LandingPage';
import { LeadModel } from '../Lead';
import { MediaFolderModel } from '../MediaFolder';
import { MediaModel } from '../Media';
import { OrderModel } from '../Order';
import { PaymentAccountModel } from '../PaymentAccount';
import { ProductModel } from '../Product';
import { RefreshSessionModel } from '../RefreshSession';
import { StorefrontConfigModel } from '../StorefrontConfig';
import { SubscriptionModel } from '../Subscription';
import { UserModel } from '../User';
import { WebhookEventModel } from '../WebhookEvent';
import { WebinarModel } from '../Webinar';
import { ReferralModel } from '../Referral';

import { daysAgo, usernameFromEmail } from './helpers';
import { seedCreatorStore } from './seedCreator';

export const SEED_MARKER_EMAIL = 'maya@demo.com';
export const SEED_PASSWORD = 'Password123!';

/** All collections wiped on full reseed. */
const ALL_MODELS: Model<any>[] = [
  UserModel, CreatorProfileModel, StorefrontConfigModel, AuthTokenModel, RefreshSessionModel,
  AuditLogModel, WebhookEventModel, JobModel, PaymentAccountModel, ProductModel, OrderModel,
  EntitlementModel, LeadModel, AnalyticsEventModel, BroadcastModel, CourseModel, CourseModuleModel,
  CourseLessonModel, EnrollmentModel, BookingModel, BookingTypeModel, ReferralModel, EmailFlowModel,
  AutoDMRuleModel, LandingPageModel, SubscriptionModel, CheckoutIntentModel, CustomerLoginCodeModel,
  IntegrationModel, InvoiceModel, MediaModel, MediaFolderModel, WebinarModel,
];

/** Everything except user accounts — used by --keep-users. */
const DATA_MODELS = ALL_MODELS.filter((m) => m !== UserModel);

async function clearModels(models: Model<any>[]): Promise<void> {
  for (const Model of models) {
    await Model.deleteMany({});
  }
}

async function ensureDefaultUsers(passwordHash: string) {
  const count = await UserModel.countDocuments();
  if (count > 0) return UserModel.find().sort({ createdAt: 1 });

  await UserModel.create([
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

  // eslint-disable-next-line no-console
  console.log('No users found — created default demo accounts.');
  return UserModel.find().sort({ createdAt: 1 });
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

async function reserveUsername(email: string, taken: Set<string>): Promise<string> {
  let base = usernameFromEmail(email);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  const username = `${base}${n}`;
  taken.add(username);
  return username;
}

export interface SeedOptions {
  force?: boolean;
  keepUsers?: boolean;
}

export async function runSeed(options: SeedOptions = {}): Promise<void> {
  const { force = false, keepUsers = false } = options;

  if (!force && !keepUsers) {
    const existing = await UserModel.findOne({ email: SEED_MARKER_EMAIL });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(
        `Seed data already exists (${SEED_MARKER_EMAIL}). Run with --force to wipe all, or --keep-users to refresh data.`,
      );
      return;
    }
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);

  if (keepUsers) {
    await clearModels(DATA_MODELS);
    // eslint-disable-next-line no-console
    console.log('Cleared all data except user accounts.');
  } else if (force) {
    await clearModels(ALL_MODELS);
  }

  const users = keepUsers ? await ensureDefaultUsers(passwordHash) : await (async () => {
    if (!force) {
      const existing = await UserModel.findOne({ email: SEED_MARKER_EMAIL });
      if (existing) return UserModel.find().sort({ createdAt: 1 });
    }
    await clearModels(ALL_MODELS);
    return ensureDefaultUsers(passwordHash);
  })();

  const takenUsernames = new Set<string>();
  const creators = users.filter((u) => u.role === 'creator');
  const results = [];

  for (const user of creators) {
    const isPrimary = user.email === SEED_MARKER_EMAIL;
    const username = isPrimary
      ? 'maya'
      : await reserveUsername(user.email, takenUsernames);
    if (isPrimary) takenUsernames.add('maya');
    const result = await seedCreatorStore(user._id, {
      username: isPrimary ? 'maya' : username,
      displayName: isPrimary ? 'Maya Chen' : displayNameFromEmail(user.email),
      published: isPrimary || user.email !== 'alex@demo.com',
      tier: isPrimary ? 'full' : 'random',
    });
    results.push(result);
  }

  const admin = users.find((u) => u.role === 'admin');
  const maya = users.find((u) => u.email === SEED_MARKER_EMAIL);

  if (admin) {
    await AuditLogModel.create({
      action: 'admin.seed',
      actorId: admin._id,
      actorType: 'admin',
      metadata: { keepUsers, creators: results.length },
      createdAt: new Date(),
    });
  }

  if (maya) {
    await RefreshSessionModel.create({
      userId: maya._id,
      jti: generateJti(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: 'seed-script',
      ip: '127.0.0.1',
    });
  }

  const alex = users.find((u) => u.email === 'alex@demo.com');
  if (alex) {
    await AuthTokenModel.create({
      userId: alex._id,
      type: 'password_reset',
      tokenHash: hashToken('seed-reset-token-not-valid'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log(`  Mode: ${keepUsers ? 'keep-users (accounts preserved)' : force ? 'force (full wipe)' : 'initial'}`);
  // eslint-disable-next-line no-console
  console.log(`  Users kept/created: ${users.length} (${creators.length} creators)`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Demo accounts (password for all):', SEED_PASSWORD);
  for (const u of users) {
    // eslint-disable-next-line no-console
    console.log(`  ${u.email} — ${u.role}`);
  }
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Seeded stores:');
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(
      `  /${r.username} — ${r.products} products, ${r.leads} contacts, ${r.orders} orders, ${r.landingPages} landing page(s)`,
    );
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const keepUsers = process.argv.includes('--keep-users');

  if (force && keepUsers) {
    // eslint-disable-next-line no-console
    console.error('Use either --force (wipe everything) or --keep-users (preserve accounts), not both.');
    process.exit(1);
  }

  try {
    await connectDb();
    await runSeed({ force, keepUsers });
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
