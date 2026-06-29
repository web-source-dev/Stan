import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { UserModel } from '../../models/User';
import { CreatorProfileModel } from '../../models/CreatorProfile';
import { RefreshSessionModel } from '../../models/RefreshSession';
import { AppError } from '../../utils/AppError';
import { recordAudit } from '../../lib/audit';
import { env } from '../../config/env';
import { renderEmail, type EmailTemplate } from '../../lib/email';
import { normalizeNotificationPrefs } from '../../lib/notificationPrefs';
import * as twoFactorService from './twoFactor.service';

// Account-level settings (mounted at /api/account).
export const accountRouter = Router();
accountRouter.use(requireAuth);

/* ------------------------------------------------------------------ */
/* Email template previews (design gallery / test page)                */
/* ------------------------------------------------------------------ */

// Representative sample data for each template so the gallery shows a realistic
// rendering. Keep keys aligned with lib/email.ts TemplateData.
const EMAIL_SAMPLES: { template: EmailTemplate; label: string; data: unknown }[] = [
  { template: 'email_verification', label: 'Email verification', data: { verifyUrl: 'https://app.example.com/verify-email?token=sample' } },
  { template: 'login_code', label: 'Login code (2FA)', data: { code: '019922' } },
  { template: 'password_reset', label: 'Password reset', data: { resetUrl: 'https://app.example.com/reset-password?token=sample' } },
  { template: 'password_changed', label: 'Password changed', data: {} },
  { template: 'purchase_receipt', label: 'Purchase receipt', data: { productTitle: 'Creator Notion Starter Pack', amount: '$29.00', fulfilmentUrl: 'https://app.example.com/access/sample', thankYouMessage: 'Thanks so much — enjoy the templates!', creatorName: 'Maya Chen' } },
  { template: 'course_enrollment', label: 'Course enrollment', data: { courseTitle: 'Content Creator Masterclass', amount: '$97.00', learnUrl: 'https://app.example.com/learn/sample', creatorName: 'Maya Chen' } },
  { template: 'booking_confirmation', label: 'Booking confirmation', data: { title: '30-min Strategy Call', whenText: 'Tue, Jun 24 at 3:00 PM', meetingUrl: 'https://meet.example.com/abc', manageUrl: 'https://app.example.com/booking/sample', creatorName: 'Maya Chen' } },
  { template: 'booking_reminder', label: 'Booking reminder', data: { title: '30-min Strategy Call', whenText: 'Tue, Jun 24 at 3:00 PM', startsInText: 'in about 24 hours', meetingUrl: 'https://meet.example.com/abc', manageUrl: 'https://app.example.com/booking/sample', creatorName: 'Maya Chen' } },
  { template: 'booking_cancelled', label: 'Booking cancelled', data: { title: '30-min Strategy Call', whenText: 'Tue, Jun 24 at 3:00 PM', reason: 'The creator had to reschedule this week.', creatorName: 'Maya Chen' } },
  { template: 'customer_login_code', label: 'Customer portal code', data: { code: '482913', creatorName: 'Maya Chen' } },
  { template: 'subscriber_welcome', label: 'Subscriber welcome', data: { creatorName: 'Maya Chen', storefrontUrl: 'https://app.example.com/maya', unsubscribeUrl: 'https://app.example.com/unsubscribe?e=sample', firstName: 'Alex' } },
  { template: 'lead_captured', label: 'Lead captured (to creator)', data: { creatorName: 'Maya Chen', subscriberEmail: 'alex@example.com', subscriberName: 'Alex', leadsUrl: 'https://app.example.com/dashboard/leads' } },
  { template: 'creator_new_sale', label: 'New sale (to creator)', data: { creatorName: 'Maya Chen', itemTitle: 'Creator Notion Starter Pack', itemKind: 'product', amount: '$29.00', buyerEmail: 'alex@example.com', buyerName: 'Alex', ordersUrl: 'https://app.example.com/dashboard/orders' } },
  { template: 'creator_new_booking', label: 'New booking (to creator)', data: { creatorName: 'Maya Chen', title: '30-min Strategy Call', whenText: 'Tue, Jun 24 at 3:00 PM', buyerEmail: 'alex@example.com', buyerName: 'Alex', bookingsUrl: 'https://app.example.com/dashboard/bookings' } },
  { template: 'creator_fulfillment_needed', label: 'Fulfillment needed (to creator)', data: { creatorName: 'Maya Chen', productTitle: 'Personalized Video Response', buyerEmail: 'alex@example.com', buyerName: 'Alex', amount: '$49.00', ordersUrl: 'https://app.example.com/dashboard/orders', fulfilmentNote: 'Deliver within 3 business days.' } },
  { template: 'custom_order_received', label: 'Custom order received (buyer)', data: { productTitle: 'Personalized Video Response', amount: '$49.00', fulfilmentUrl: 'https://app.example.com/access/sample', fulfilmentNote: 'Deliver within 3 business days.', creatorName: 'Maya Chen' } },
  { template: 'custom_order_delivered', label: 'Custom order delivered (buyer)', data: { productTitle: 'Personalized Video Response', fulfilmentUrl: 'https://app.example.com/access/sample', fulfillmentMessage: 'Here is your personalized video — thanks for your patience!', deliveryUrl: 'https://example.com/delivery', creatorName: 'Maya Chen' } },
  { template: 'membership_welcome', label: 'Membership welcome', data: { productTitle: 'VIP Creator Club', amount: '$9.99', interval: 'month', accessUrl: 'https://discord.gg/example', fulfilmentUrl: 'https://app.example.com/access/sample', creatorName: 'Maya Chen' } },
  { template: 'recurring_payment', label: 'Recurring payment (buyer)', data: { productTitle: 'VIP Creator Club', amount: '$9.99', interval: 'month', accessUrl: 'https://discord.gg/example', fulfilmentUrl: 'https://app.example.com/access/sample', creatorName: 'Maya Chen' } },
  { template: 'membership_cancelled', label: 'Membership cancelled (buyer)', data: { productTitle: 'VIP Creator Club', creatorName: 'Maya Chen' } },
  { template: 'membership_payment_failed', label: 'Membership payment failed (buyer)', data: { productTitle: 'VIP Creator Club', amount: '$9.99', creatorName: 'Maya Chen' } },
  { template: 'creator_membership_cancelled', label: 'Membership cancelled (to creator)', data: { creatorName: 'Maya Chen', productTitle: 'VIP Creator Club', buyerEmail: 'alex@example.com', buyerName: 'Alex', leadsUrl: 'https://app.example.com/dashboard/leads' } },
  { template: 'broadcast', label: 'Broadcast / newsletter', data: { subject: 'New drop: Summer Content Kit 🌞', bodyText: 'Hey!\n\nMy new Summer Content Kit is live — 60 plug-and-play templates to plan a whole season in an afternoon.\n\nGrab it this week for 20% off.', fromName: 'Maya Chen', unsubscribeUrl: 'https://app.example.com/unsubscribe?e=sample' } },
];

accountRouter.get(
  '/email-previews',
  asyncHandler(async (_req, res) => {
    const templates = EMAIL_SAMPLES.map((s) => {
      const rendered = renderEmail(s.template, s.data as never);
      return { key: s.template, label: s.label, subject: rendered.subject, html: rendered.html, text: rendered.text };
    });
    res.json({
      config: {
        configured: env.emailConfigured,
        from: env.EMAIL_FROM,
        sandbox: env.EMAIL_FROM.includes('resend.dev'),
      },
      templates,
    });
  }),
);

const PREF_KEYS = [
  'calendarBookings',
  'ordersFulfillment',
  'purchaseConfirmations',
  'leadCaptured',
  'membershipCancellations',
  'recurringPayments',
] as const;

const prefsSchema = z.object(
  Object.fromEntries(PREF_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
    (typeof PREF_KEYS)[number],
    z.ZodOptional<z.ZodBoolean>
  >,
);

accountRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id).select('notificationPrefs twoFactorEnabled twoFactorEmail twoFactorAuthenticator');
    if (!user) throw AppError.notFound('User not found');
    const status = await twoFactorService.getTwoFactorStatus(req.user!.id);
    res.json({ prefs: normalizeNotificationPrefs(user.get('notificationPrefs') as Record<string, boolean>), twoFactorEnabled: status.enabled, twoFactor: status });
  }),
);

accountRouter.patch(
  '/notifications',
  validate({ body: prefsSchema }),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    if (!user) throw AppError.notFound('User not found');
    const prefs = normalizeNotificationPrefs(user.get('notificationPrefs') as Record<string, boolean>);
    for (const k of PREF_KEYS) if (typeof req.body[k] === 'boolean') prefs[k] = req.body[k];
    user.set('notificationPrefs', prefs);
    await user.save();
    res.json({ prefs: normalizeNotificationPrefs(user.get('notificationPrefs') as Record<string, boolean>) });
  }),
);

accountRouter.get(
  '/two-factor',
  asyncHandler(async (req, res) => {
    res.json(await twoFactorService.getTwoFactorStatus(req.user!.id));
  }),
);

accountRouter.post(
  '/two-factor/email',
  validate({ body: z.object({ enabled: z.boolean(), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    res.json(await twoFactorService.setEmailTwoFactor(req.user!.id, req.body.enabled, req.body.password));
  }),
);

accountRouter.post(
  '/two-factor/authenticator/setup',
  validate({ body: z.object({ password: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    res.json(await twoFactorService.startAuthenticatorSetup(req.user!.id, req.body.password));
  }),
);

accountRouter.post(
  '/two-factor/authenticator/cancel',
  asyncHandler(async (req, res) => {
    await twoFactorService.cancelAuthenticatorSetup(req.user!.id);
    res.json({ ok: true });
  }),
);

accountRouter.post(
  '/two-factor/authenticator/confirm',
  validate({
    body: z.object({
      code: z.string().min(4).max(10),
      secret: z.string().min(16).max(128).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.json(await twoFactorService.confirmAuthenticatorSetup(req.user!.id, req.body.code, req.body.secret));
  }),
);

accountRouter.post(
  '/two-factor/authenticator/disable',
  validate({ body: z.object({ password: z.string().min(1), code: z.string().min(4).max(10) }) }),
  asyncHandler(async (req, res) => {
    res.json(await twoFactorService.disableAuthenticator(req.user!.id, req.body.password, req.body.code));
  }),
);

/** @deprecated Use /two-factor/email instead */
accountRouter.post(
  '/two-factor',
  validate({ body: z.object({ enabled: z.boolean(), password: z.string().min(1).optional() }) }),
  asyncHandler(async (req, res) => {
    const password = req.body.password ?? '';
    if (!password) throw AppError.badRequest('Password is required to change two-factor settings.');
    const status = await twoFactorService.setEmailTwoFactor(req.user!.id, req.body.enabled, password);
    res.json({ twoFactorEnabled: status.enabled, twoFactor: status });
  }),
);

accountRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const sessions = await RefreshSessionModel.find({
      userId: req.user!.id,
      revokedAt: { $exists: false },
      replacedByJti: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(20);
    // The most recently issued active session is treated as the current device.
    res.json({
      sessions: sessions.map((s, i) => ({
        id: s.id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.get('createdAt'),
        current: i === 0,
      })),
    });
  }),
);

// Revoke a single session by id (sign out one specific device).
accountRouter.post(
  '/sessions/:id/revoke',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  asyncHandler(async (req, res) => {
    const result = await RefreshSessionModel.updateOne(
      { _id: req.params.id, userId: req.user!.id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw AppError.notFound('Session not found');
    res.json({ ok: true });
  }),
);

// Revoke every active session except the most recent (the current device).
accountRouter.post(
  '/sessions/revoke-others',
  asyncHandler(async (req, res) => {
    const active = await RefreshSessionModel.find({
      userId: req.user!.id,
      revokedAt: { $exists: false },
      replacedByJti: { $exists: false },
    }).sort({ createdAt: -1 });
    const toRevoke = active.slice(1).map((s) => s.id);
    if (toRevoke.length) {
      await RefreshSessionModel.updateMany({ _id: { $in: toRevoke } }, { $set: { revokedAt: new Date() } });
    }
    res.json({ ok: true, revoked: toRevoke.length });
  }),
);

accountRouter.post(
  '/delete',
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    if (!user) throw AppError.notFound('User not found');
    user.set('status', 'deactivated');
    user.set('tokenVersion', (user.get('tokenVersion') ?? 0) + 1);
    await user.save();
    // Take the public storefront down so a deactivated account is no longer
    // reachable or purchasable.
    await CreatorProfileModel.updateOne({ userId: user.id }, { $set: { published: false } });
    await RefreshSessionModel.updateMany({ userId: user.id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    recordAudit({ action: 'account.delete_requested', actorType: 'user', actorId: user.id, creatorId: user.id });
    res.json({ ok: true });
  }),
);
