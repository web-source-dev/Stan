import { UserModel } from '../models/User';
import { CreatorProfileModel } from '../models/CreatorProfile';
import { env } from '../config/env';
import { enqueueEmail } from './jobs';
import type { EmailTemplate } from './email';
import { isNotificationPrefEnabled } from './notificationPrefs';

export type CreatorNotificationPref =
  | 'calendarBookings'
  | 'ordersFulfillment'
  | 'purchaseConfirmations'
  | 'leadCaptured'
  | 'membershipCancellations'
  | 'recurringPayments';

/** Send a creator-facing email when their notification pref is enabled (default on). */
export async function notifyCreatorIfEnabled(
  creatorId: string,
  pref: CreatorNotificationPref,
  template: EmailTemplate,
  data: Record<string, unknown>,
  dedupeKey?: string,
): Promise<void> {
  const user = await UserModel.findById(creatorId).select('email notificationPrefs');
  if (!user?.email) return;
  const prefs = user.get('notificationPrefs') as Partial<Record<CreatorNotificationPref, boolean>> | undefined;
  if (!isNotificationPrefEnabled(prefs, pref)) return;

  await enqueueEmail(user.email, template, data, dedupeKey ? { dedupeKey } : {});
}

export async function resolveCreatorBranding(creatorId: string): Promise<{
  displayName: string;
  username: string;
  replyTo?: string;
}> {
  const [profile, user] = await Promise.all([
    CreatorProfileModel.findOne({ userId: creatorId }).select('displayName username').lean(),
    UserModel.findById(creatorId).select('email').lean(),
  ]);
  const username = profile?.username ?? '';
  const displayName = profile?.displayName || username || 'CreatorStore';
  return { displayName, username, replyTo: user?.email };
}

export async function notifyCreatorNewSale(
  creatorId: string,
  input: {
    itemTitle: string;
    itemKind: 'product' | 'course';
    amount: string;
    buyerEmail: string;
    buyerName?: string;
    orderId: string;
  },
): Promise<void> {
  const { displayName } = await resolveCreatorBranding(creatorId);
  await notifyCreatorIfEnabled(
    creatorId,
    'purchaseConfirmations',
    'creator_new_sale',
    {
      creatorName: displayName,
      itemTitle: input.itemTitle,
      itemKind: input.itemKind,
      amount: input.amount,
      buyerEmail: input.buyerEmail,
      buyerName: input.buyerName || input.buyerEmail,
      ordersUrl: `${env.APP_URL}/dashboard/orders`,
    },
    `creator_sale:${input.orderId}`,
  );
}

export async function notifyCreatorFulfillmentNeeded(
  creatorId: string,
  input: {
    productTitle: string;
    buyerEmail: string;
    buyerName?: string;
    amount: string;
    orderId: string;
    fulfilmentNote?: string;
  },
): Promise<void> {
  const { displayName } = await resolveCreatorBranding(creatorId);
  await notifyCreatorIfEnabled(
    creatorId,
    'ordersFulfillment',
    'creator_fulfillment_needed',
    {
      creatorName: displayName,
      productTitle: input.productTitle,
      buyerEmail: input.buyerEmail,
      buyerName: input.buyerName || input.buyerEmail,
      amount: input.amount,
      ordersUrl: `${env.APP_URL}/dashboard/orders`,
      fulfilmentNote: input.fulfilmentNote || '',
    },
    `creator_fulfillment:${input.orderId}`,
  );
}

export async function notifyCreatorNewBooking(
  creatorId: string,
  input: {
    title: string;
    whenText: string;
    buyerEmail: string;
    buyerName?: string;
    bookingId: string;
  },
): Promise<void> {
  const { displayName } = await resolveCreatorBranding(creatorId);
  await notifyCreatorIfEnabled(
    creatorId,
    'calendarBookings',
    'creator_new_booking',
    {
      creatorName: displayName,
      title: input.title,
      whenText: input.whenText,
      buyerEmail: input.buyerEmail,
      buyerName: input.buyerName || input.buyerEmail,
      bookingsUrl: `${env.APP_URL}/dashboard/bookings`,
    },
    `creator_booking:${input.bookingId}`,
  );
}
