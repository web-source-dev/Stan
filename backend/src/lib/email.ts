import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

const resend = env.emailConfigured ? new Resend(env.RESEND_API_KEY) : null;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface DeliverOptions {
  fromName?: string;
  replyTo?: string;
}

export type EmailTemplate =
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'purchase_receipt'
  | 'course_enrollment'
  | 'broadcast'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'customer_login_code'
  | 'login_code'
  | 'subscriber_welcome'
  | 'lead_captured'
  | 'creator_new_sale'
  | 'creator_new_booking'
  | 'creator_fulfillment_needed'
  | 'custom_order_received'
  | 'custom_order_delivered'
  | 'membership_welcome'
  | 'recurring_payment'
  | 'membership_cancelled'
  | 'creator_membership_cancelled'
  | 'membership_payment_failed';

interface TemplateData {
  email_verification: { verifyUrl: string };
  password_reset: { resetUrl: string };
  password_changed: Record<string, never>;
  purchase_receipt: {
    productTitle: string;
    amount: string;
    fulfilmentUrl: string;
    thankYouMessage?: string;
    portalUrl?: string;
    creatorName?: string;
  };
  course_enrollment: {
    courseTitle: string;
    amount: string;
    learnUrl: string;
    creatorName?: string;
    portalUrl?: string;
  };
  broadcast: {
    subject: string;
    bodyHtml?: string;
    bodyText: string;
    fromName?: string;
    unsubscribeUrl?: string;
  };
  booking_confirmation: {
    title: string;
    whenText: string;
    meetingUrl?: string;
    manageUrl: string;
    portalUrl?: string;
    creatorName?: string;
  };
  booking_reminder: {
    title: string;
    whenText: string;
    startsInText: string;
    meetingUrl?: string;
    manageUrl: string;
    portalUrl?: string;
    creatorName?: string;
  };
  booking_cancelled: {
    title: string;
    whenText: string;
    reason?: string;
    creatorName?: string;
  };
  customer_login_code: {
    code: string;
    creatorName: string;
  };
  login_code: {
    code: string;
  };
  subscriber_welcome: {
    creatorName: string;
    storefrontUrl: string;
    unsubscribeUrl: string;
    firstName?: string;
  };
  lead_captured: {
    creatorName: string;
    subscriberEmail: string;
    subscriberName: string;
    leadsUrl: string;
  };
  creator_new_sale: {
    creatorName: string;
    itemTitle: string;
    itemKind: 'product' | 'course';
    amount: string;
    buyerEmail: string;
    buyerName: string;
    ordersUrl: string;
  };
  creator_new_booking: {
    creatorName: string;
    title: string;
    whenText: string;
    buyerEmail: string;
    buyerName: string;
    bookingsUrl: string;
  };
  creator_fulfillment_needed: {
    creatorName: string;
    productTitle: string;
    buyerEmail: string;
    buyerName: string;
    amount: string;
    ordersUrl: string;
    fulfilmentNote?: string;
  };
  custom_order_received: {
    productTitle: string;
    amount: string;
    fulfilmentUrl: string;
    fulfilmentNote?: string;
    creatorName?: string;
    portalUrl?: string;
  };
  custom_order_delivered: {
    productTitle: string;
    fulfilmentUrl: string;
    fulfillmentMessage?: string;
    deliveryUrl?: string;
    creatorName?: string;
    portalUrl?: string;
  };
  membership_welcome: {
    productTitle: string;
    amount: string;
    interval: string;
    accessUrl: string;
    fulfilmentUrl: string;
    creatorName?: string;
    portalUrl?: string;
    thankYouMessage?: string;
  };
  recurring_payment: {
    productTitle: string;
    amount: string;
    interval: string;
    accessUrl: string;
    fulfilmentUrl: string;
    creatorName?: string;
  };
  membership_cancelled: {
    productTitle: string;
    creatorName?: string;
    reason?: string;
  };
  creator_membership_cancelled: {
    creatorName: string;
    productTitle: string;
    buyerEmail: string;
    buyerName: string;
    leadsUrl: string;
  };
  membership_payment_failed: {
    productTitle: string;
    amount: string;
    creatorName?: string;
    updatePaymentUrl?: string;
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

const BRAND = '#1a1c3a';
const ACCENT = '#635bff';

function layout(title: string, body: string, opts?: { preheader?: string; footer?: string }) {
  const preheader = opts?.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>`
    : '';
  const footer = opts?.footer ?? 'Sent via CreatorStore';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(26,28,58,0.08)">
<tr><td style="background:linear-gradient(135deg,${BRAND} 0%,#2d3168 100%);padding:28px 32px 24px">
  <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.7)">CreatorStore</p>
  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff">${escapeHtml(title)}</h1>
</td></tr>
<tr><td style="padding:28px 32px 32px;color:#333333;font-size:15px;line-height:1.6">
  ${body}
</td></tr>
<tr><td style="padding:0 32px 28px">
  <p style="margin:0;font-size:12px;color:#999999;line-height:1.5">${escapeHtml(footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function button(url: string, label: string, primary = true): string {
  const bg = primary ? ACCENT : '#eeeeee';
  const color = primary ? '#ffffff' : BRAND;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr>
<td style="border-radius:10px;background:${bg}">
  <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:${color};text-decoration:none;border-radius:10px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function codeBlock(code: string): string {
  return `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0;padding:16px 20px;background:#f4f4f7;border-radius:12px;text-align:center;color:${BRAND}">${escapeHtml(code)}</p>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
<td style="padding:8px 0;color:#888888;font-size:13px;width:100px;vertical-align:top">${escapeHtml(label)}</td>
<td style="padding:8px 0;color:#333333;font-size:14px;font-weight:500">${escapeHtml(value)}</td>
</tr>`;
}

function detailTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;background:#fafafa;border-radius:12px;padding:4px 16px">${rows}</table>`;
}

function muted(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:#888888;line-height:1.5">${text}</p>`;
}

function portalSection(portalUrl: string): string {
  return `<div style="margin-top:28px;padding-top:24px;border-top:1px solid #eeeeee">
<p style="margin:0 0 4px;font-size:14px;color:#555555">All your purchases from this creator in one place:</p>
${button(portalUrl, 'View my purchases')}
${muted('Your email is pre-filled — confirm with a quick one-time code.')}
</div>`;
}

export function renderEmail<T extends EmailTemplate>(
  template: T,
  data: TemplateData[T],
): RenderedEmail {
  switch (template) {
    case 'email_verification': {
      const { verifyUrl } = data as TemplateData['email_verification'];
      return {
        subject: 'Verify your CreatorStore email',
        html: layout(
          'Confirm your email',
          `<p style="margin:0 0 8px">Welcome! Confirm your email address to activate your CreatorStore account and start selling.</p>
${button(verifyUrl, 'Verify email address')}
${muted('This link expires in 24 hours. If you didn&apos;t create an account, you can ignore this email.')}`,
          { preheader: 'One click to activate your CreatorStore account.' },
        ),
        text: `Confirm your email address: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      };
    }
    case 'password_reset': {
      const { resetUrl } = data as TemplateData['password_reset'];
      return {
        subject: 'Reset your CreatorStore password',
        html: layout(
          'Reset your password',
          `<p style="margin:0 0 8px">We received a request to reset your password. Click below to choose a new one.</p>
${button(resetUrl, 'Reset password')}
${muted('If you didn&apos;t request this, ignore this email — your password stays the same. Link expires in 1 hour.')}`,
          { preheader: 'Reset your CreatorStore password.' },
        ),
        text: `Reset your password: ${resetUrl}\n\nExpires in 1 hour. If you didn't request this, ignore this email.`,
      };
    }
    case 'password_changed': {
      return {
        subject: 'Your CreatorStore password was changed',
        html: layout(
          'Password changed',
          `<p style="margin:0">Your password was just changed successfully.</p>
${muted('If this wasn&apos;t you, reset your password immediately and contact support.')}`,
          { preheader: 'Your CreatorStore password was updated.' },
        ),
        text: 'Your password was just changed. If this was not you, reset it immediately.',
      };
    }
    case 'purchase_receipt': {
      const { productTitle, amount, fulfilmentUrl, thankYouMessage, portalUrl, creatorName } =
        data as TemplateData['purchase_receipt'];
      const from = creatorName ? ` from ${creatorName}` : '';
      return {
        subject: `Your purchase: ${productTitle}`,
        html: layout(
          'Thanks for your purchase',
          `<p style="margin:0 0 16px">You bought <strong>${escapeHtml(productTitle)}</strong>${from} for <strong>${escapeHtml(amount)}</strong>.</p>` +
            (thankYouMessage ? `<p style="margin:0 0 16px;padding:16px;background:#f9f9fb;border-radius:10px;border-left:3px solid ${ACCENT}">${nl2br(thankYouMessage)}</p>` : '') +
            `${button(fulfilmentUrl, 'Access your purchase')}` +
            muted('For your security, you&apos;ll confirm this email with a one-time code before accessing your files. Keep this email — you can return anytime to re-download.') +
            (portalUrl ? portalSection(portalUrl) : ''),
          { preheader: `Your purchase of ${productTitle} is ready.` },
        ),
        text:
          `Thanks for buying ${productTitle} (${amount}). Access your purchase: ${fulfilmentUrl}` +
          `\n\nYou'll confirm this email with a one-time code to unlock your files.` +
          (thankYouMessage ? `\n\n${thankYouMessage}` : '') +
          (portalUrl ? `\n\nView all your purchases: ${portalUrl}` : ''),
      };
    }
    case 'course_enrollment': {
      const { courseTitle, amount, learnUrl, creatorName, portalUrl } =
        data as TemplateData['course_enrollment'];
      const from = creatorName ? ` from ${creatorName}` : '';
      return {
        subject: `You're enrolled: ${courseTitle}`,
        html: layout(
          'Welcome to your course',
          `<p style="margin:0 0 16px">You&apos;re enrolled in <strong>${escapeHtml(courseTitle)}</strong>${from}${amount ? ` (${escapeHtml(amount)})` : ''}.</p>
<p style="margin:0 0 8px">Start learning right away — your progress is saved automatically.</p>
${button(learnUrl, 'Start the course')}
${muted('Bookmark this link to return anytime. You&apos;ll confirm your email with a quick code on first visit.')}
${portalUrl ? portalSection(portalUrl) : ''}`,
          { preheader: `Start learning ${courseTitle} now.` },
        ),
        text: `You're enrolled in ${courseTitle}. Start here: ${learnUrl}` + (portalUrl ? `\n\nAll purchases: ${portalUrl}` : ''),
      };
    }
    case 'broadcast': {
      const { subject, bodyHtml, bodyText, fromName, unsubscribeUrl } =
        data as TemplateData['broadcast'];
      const safeHtml = bodyHtml || nl2br(bodyText);
      const footer = unsubscribeUrl
        ? `<p style="margin:24px 0 0;font-size:12px;color:#aaaaaa"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#aaaaaa">Unsubscribe</a></p>`
        : undefined;
      return {
        subject,
        html: layout(fromName || 'Update', `<div style="font-size:15px;line-height:1.65">${safeHtml}</div>`, {
          preheader: bodyText.slice(0, 120),
          footer: footer ? undefined : 'Sent via CreatorStore',
        }) + (footer ?? ''),
        text: unsubscribeUrl ? `${bodyText}\n\nUnsubscribe: ${unsubscribeUrl}` : bodyText,
      };
    }
    case 'booking_confirmation': {
      const { title, whenText, meetingUrl, manageUrl, portalUrl, creatorName } =
        data as TemplateData['booking_confirmation'];
      return {
        subject: `Booking confirmed: ${title}`,
        html: layout(
          'Your booking is confirmed',
          `${detailTable(infoRow('Session', title) + infoRow('When', whenText) + (creatorName ? infoRow('With', creatorName) : ''))}` +
            (meetingUrl ? button(meetingUrl, 'Join the meeting') : '') +
            `<p style="margin:16px 0 0;font-size:14px"><a href="${escapeHtml(manageUrl)}" style="color:${ACCENT};font-weight:600">Reschedule or cancel</a></p>` +
            (portalUrl ? portalSection(portalUrl) : ''),
          { preheader: `${title} — ${whenText}` },
        ),
        text:
          `Booking confirmed: ${title}\n${whenText}` +
          (meetingUrl ? `\nMeeting: ${meetingUrl}` : '') +
          `\nManage: ${manageUrl}` +
          (portalUrl ? `\n\nView all purchases: ${portalUrl}` : ''),
      };
    }
    case 'booking_reminder': {
      const { title, whenText, startsInText, meetingUrl, manageUrl, portalUrl, creatorName } =
        data as TemplateData['booking_reminder'];
      return {
        subject: `Reminder: ${title} is ${startsInText}`,
        html: layout(
          'Your booking is coming up',
          `<p style="margin:0 0 16px"><strong>${escapeHtml(title)}</strong> starts <strong>${escapeHtml(startsInText)}</strong>.</p>` +
            `${detailTable(infoRow('When', whenText) + (creatorName ? infoRow('With', creatorName) : ''))}` +
            (meetingUrl ? button(meetingUrl, 'Join the meeting') : '') +
            `<p style="margin:16px 0 0;font-size:14px"><a href="${escapeHtml(manageUrl)}" style="color:${ACCENT};font-weight:600">Reschedule or cancel</a></p>` +
            (portalUrl ? portalSection(portalUrl) : ''),
          { preheader: `${title} starts ${startsInText}.` },
        ),
        text:
          `Reminder: ${title} is ${startsInText}.\n${whenText}` +
          (meetingUrl ? `\nMeeting: ${meetingUrl}` : '') +
          `\nManage: ${manageUrl}` +
          (portalUrl ? `\n\nView all purchases: ${portalUrl}` : ''),
      };
    }
    case 'booking_cancelled': {
      const { title, whenText, reason, creatorName } = data as TemplateData['booking_cancelled'];
      return {
        subject: `Booking cancelled: ${title}`,
        html: layout(
          'Booking cancelled',
          `<p style="margin:0 0 16px">Your booking for <strong>${escapeHtml(title)}</strong> (${escapeHtml(whenText)}) has been cancelled.</p>` +
            (reason ? `<p style="margin:0 0 16px;padding:14px;background:#fff8f0;border-radius:10px;color:#555">${nl2br(reason)}</p>` : '') +
            (creatorName ? muted(`Questions? Reply to ${escapeHtml(creatorName)} directly.`) : muted('If you believe this was a mistake, contact the creator directly.')),
          { preheader: `Your booking for ${title} was cancelled.` },
        ),
        text:
          `Your booking for ${title} (${whenText}) has been cancelled.` +
          (reason ? `\n\n${reason}` : '') +
          `\n\nIf you believe this was a mistake, please contact the creator directly.`,
      };
    }
    case 'customer_login_code': {
      const { code, creatorName } = data as TemplateData['customer_login_code'];
      return {
        subject: `Your ${creatorName} access code: ${code}`,
        html: layout(
          'Your login code',
          `<p style="margin:0 0 8px">Use this code to access your purchases from <strong>${escapeHtml(creatorName)}</strong>:</p>
${codeBlock(code)}
${muted('Expires in 10 minutes. If you didn&apos;t request this, you can ignore this email.')}`,
          { preheader: `Your access code is ${code}` },
        ),
        text: `Your ${creatorName} access code is ${code}. It expires in 10 minutes.`,
      };
    }
    case 'login_code': {
      const { code } = data as TemplateData['login_code'];
      return {
        subject: `Your login code: ${code}`,
        html: layout(
          'Your login code',
          `<p style="margin:0 0 8px">Use this code to finish signing in to your CreatorStore account:</p>
${codeBlock(code)}
${muted('Expires in 10 minutes. If you didn&apos;t try to log in, change your password immediately.')}`,
          { preheader: `Your CreatorStore login code is ${code}` },
        ),
        text: `Your CreatorStore login code is ${code}. It expires in 10 minutes.`,
      };
    }
    case 'subscriber_welcome': {
      const { creatorName, storefrontUrl, unsubscribeUrl, firstName } =
        data as TemplateData['subscriber_welcome'];
      const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
      return {
        subject: `You're on ${creatorName}'s list`,
        html: layout(
          `Welcome to ${creatorName}'s list`,
          `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px">Thanks for subscribing to updates from <strong>${escapeHtml(creatorName)}</strong>. You&apos;ll be first to hear about new drops, tips, and announcements.</p>
${button(storefrontUrl, `Visit ${creatorName}'s store`)}
<p style="margin:24px 0 0;font-size:12px;color:#aaaaaa"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#aaaaaa">Unsubscribe</a></p>`,
          { preheader: `You're subscribed to ${creatorName}.` },
        ),
        text:
          `${greeting}\n\nThanks for subscribing to updates from ${creatorName}.\n\nVisit the store: ${storefrontUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
      };
    }
    case 'lead_captured': {
      const { creatorName, subscriberEmail, subscriberName, leadsUrl } =
        data as TemplateData['lead_captured'];
      return {
        subject: `New subscriber on ${creatorName}`,
        html: layout(
          'New email subscriber',
          `<p style="margin:0 0 16px">Someone just joined your list on <strong>${escapeHtml(creatorName)}</strong>.</p>
${detailTable(infoRow('Name', subscriberName) + infoRow('Email', subscriberEmail))}
${button(leadsUrl, 'View contacts')}`,
          { preheader: `${subscriberName} subscribed to your list.` },
        ),
        text: `${subscriberName} (${subscriberEmail}) subscribed on your storefront.\n\nView contacts: ${leadsUrl}`,
      };
    }
    case 'creator_new_sale': {
      const { creatorName, itemTitle, itemKind, amount, buyerEmail, buyerName, ordersUrl } =
        data as TemplateData['creator_new_sale'];
      const kindLabel = itemKind === 'course' ? 'Course' : 'Product';
      return {
        subject: `New sale: ${itemTitle} (${amount})`,
        html: layout(
          'You made a sale!',
          `<p style="margin:0 0 16px">Great news — someone just purchased from <strong>${escapeHtml(creatorName)}</strong>.</p>
${detailTable(infoRow('Item', itemTitle) + infoRow('Type', kindLabel) + infoRow('Amount', amount) + infoRow('Buyer', buyerName) + infoRow('Email', buyerEmail))}
${button(ordersUrl, 'View in Income')}`,
          { preheader: `New ${kindLabel.toLowerCase()} sale: ${itemTitle} for ${amount}.` },
        ),
        text: `New sale: ${itemTitle} (${amount})\nBuyer: ${buyerName} (${buyerEmail})\n\nView orders: ${ordersUrl}`,
      };
    }
    case 'creator_new_booking': {
      const { creatorName, title, whenText, buyerEmail, buyerName, bookingsUrl } =
        data as TemplateData['creator_new_booking'];
      return {
        subject: `New booking: ${title}`,
        html: layout(
          'New calendar booking',
          `<p style="margin:0 0 16px">Someone booked a session on <strong>${escapeHtml(creatorName)}</strong>.</p>
${detailTable(infoRow('Session', title) + infoRow('When', whenText) + infoRow('Guest', buyerName) + infoRow('Email', buyerEmail))}
${button(bookingsUrl, 'View bookings')}`,
          { preheader: `${buyerName} booked ${title} — ${whenText}.` },
        ),
        text: `New booking: ${title}\n${whenText}\nGuest: ${buyerName} (${buyerEmail})\n\nView bookings: ${bookingsUrl}`,
      };
    }
    case 'creator_fulfillment_needed': {
      const { creatorName, productTitle, buyerEmail, buyerName, amount, ordersUrl, fulfilmentNote } =
        data as TemplateData['creator_fulfillment_needed'];
      return {
        subject: `Action needed: fulfill ${productTitle}`,
        html: layout(
          'Order needs fulfillment',
          `<p style="margin:0 0 16px">A customer purchased a custom product on <strong>${escapeHtml(creatorName)}</strong> and is waiting for delivery.</p>
${detailTable(infoRow('Product', productTitle) + infoRow('Amount', amount) + infoRow('Buyer', buyerName) + infoRow('Email', buyerEmail))}` +
            (fulfilmentNote
              ? `<p style="margin:0 0 16px;padding:14px;background:#fff8f0;border-radius:10px"><strong>Your delivery promise:</strong> ${escapeHtml(fulfilmentNote)}</p>`
              : '') +
            `${button(ordersUrl, 'View order in dashboard')}`,
          { preheader: `Fulfill ${productTitle} for ${buyerName}.` },
        ),
        text:
          `Custom order needs fulfillment: ${productTitle} (${amount})\nBuyer: ${buyerName} (${buyerEmail})` +
          (fulfilmentNote ? `\n\nDelivery promise: ${fulfilmentNote}` : '') +
          `\n\nView orders: ${ordersUrl}`,
      };
    }
    case 'custom_order_received': {
      const { productTitle, amount, fulfilmentUrl, fulfilmentNote, creatorName, portalUrl } =
        data as TemplateData['custom_order_received'];
      const from = creatorName ? ` from ${creatorName}` : '';
      return {
        subject: `Order received: ${productTitle}`,
        html: layout(
          'Thanks for your order',
          `<p style="margin:0 0 16px">You ordered <strong>${escapeHtml(productTitle)}</strong>${from} for <strong>${escapeHtml(amount)}</strong>.</p>
<p style="margin:0 0 16px">The creator is preparing your custom order now. We&apos;ll email you as soon as it&apos;s ready.</p>` +
            (fulfilmentNote
              ? `<p style="margin:0 0 16px;padding:14px;background:#f9f9fb;border-radius:10px"><strong>What to expect:</strong> ${escapeHtml(fulfilmentNote)}</p>`
              : '') +
            `${button(fulfilmentUrl, 'View order status')}` +
            muted('Bookmark this link to check delivery status anytime. You&apos;ll confirm your email with a one-time code on first visit.') +
            (portalUrl ? portalSection(portalUrl) : ''),
          { preheader: `Your custom order for ${productTitle} is being prepared.` },
        ),
        text:
          `Thanks for ordering ${productTitle} (${amount}). The creator is preparing your custom order.` +
          (fulfilmentNote ? `\n\nWhat to expect: ${fulfilmentNote}` : '') +
          `\n\nCheck status: ${fulfilmentUrl}` +
          (portalUrl ? `\n\nView all purchases: ${portalUrl}` : ''),
      };
    }
    case 'custom_order_delivered': {
      const { productTitle, fulfilmentUrl, fulfillmentMessage, deliveryUrl, creatorName, portalUrl } =
        data as TemplateData['custom_order_delivered'];
      const from = creatorName ? ` from ${creatorName}` : '';
      return {
        subject: `Your order is ready: ${productTitle}`,
        html: layout(
          'Your order is ready',
          `<p style="margin:0 0 16px">Your custom order <strong>${escapeHtml(productTitle)}</strong>${from} has been delivered.</p>` +
            (fulfillmentMessage
              ? `<p style="margin:0 0 16px;padding:16px;background:#f9f9fb;border-radius:10px;border-left:3px solid ${ACCENT}">${nl2br(fulfillmentMessage)}</p>`
              : '') +
            `${button(fulfilmentUrl, 'Access your delivery')}` +
            (deliveryUrl ? `<p style="margin:16px 0 0"><a href="${escapeHtml(deliveryUrl)}">Open delivery link</a></p>` : '') +
            muted('For your security, you&apos;ll confirm this email with a one-time code before accessing your files.') +
            (portalUrl ? portalSection(portalUrl) : ''),
          { preheader: `${productTitle} is ready to access.` },
        ),
        text:
          `Your custom order ${productTitle} is ready.` +
          (fulfillmentMessage ? `\n\n${fulfillmentMessage}` : '') +
          `\n\nAccess your delivery: ${fulfilmentUrl}` +
          (deliveryUrl ? `\n\nDelivery link: ${deliveryUrl}` : '') +
          (portalUrl ? `\n\nView all purchases: ${portalUrl}` : ''),
      };
    }
    case 'membership_welcome': {
      const { productTitle, amount, interval, accessUrl, fulfilmentUrl, creatorName, portalUrl, thankYouMessage } =
        data as TemplateData['membership_welcome'];
      const from = creatorName ? ` from ${creatorName}` : '';
      return {
        subject: `Welcome to ${productTitle}`,
        html: layout(
          'Your membership is active',
          `<p style="margin:0 0 16px">You&apos;re subscribed to <strong>${escapeHtml(productTitle)}</strong>${from} at <strong>${escapeHtml(amount)}</strong> / ${escapeHtml(interval)}.</p>` +
            (thankYouMessage ? `<p style="margin:0 0 16px;padding:16px;background:#f9f9fb;border-radius:10px;border-left:3px solid ${ACCENT}">${nl2br(thankYouMessage)}</p>` : '') +
            `${button(accessUrl, 'Access your membership')}` +
            muted('Your subscription renews automatically. Manage access anytime from your member portal link below.') +
            (portalUrl ? portalSection(portalUrl) : `<p style="margin-top:16px;font-size:13px"><a href="${escapeHtml(fulfilmentUrl)}">Member portal link</a></p>`),
          { preheader: `You're in — ${productTitle} is ready.` },
        ),
        text:
          `Welcome to ${productTitle} (${amount}/${interval}). Access: ${accessUrl}` +
          (thankYouMessage ? `\n\n${thankYouMessage}` : '') +
          (portalUrl ? `\n\nAll purchases: ${portalUrl}` : `\n\nPortal: ${fulfilmentUrl}`),
      };
    }
    case 'recurring_payment': {
      const { productTitle, amount, interval, accessUrl, fulfilmentUrl, creatorName } =
        data as TemplateData['recurring_payment'];
      return {
        subject: `Payment received: ${productTitle}`,
        html: layout(
          'Subscription renewed',
          `<p style="margin:0 0 16px">Your <strong>${escapeHtml(interval)}</strong> payment of <strong>${escapeHtml(amount)}</strong> for <strong>${escapeHtml(productTitle)}</strong>${creatorName ? ` from ${escapeHtml(creatorName)}` : ''} was successful.</p>
${button(accessUrl, 'Access your membership')}
<p style="margin-top:16px;font-size:13px"><a href="${escapeHtml(fulfilmentUrl)}">Member portal</a></p>`,
          { preheader: `${amount} payment for ${productTitle}.` },
        ),
        text: `Payment of ${amount} for ${productTitle} (${interval}). Access: ${accessUrl}`,
      };
    }
    case 'membership_cancelled': {
      const { productTitle, creatorName, reason } = data as TemplateData['membership_cancelled'];
      return {
        subject: `Membership ended: ${productTitle}`,
        html: layout(
          'Membership cancelled',
          `<p style="margin:0 0 16px">Your subscription to <strong>${escapeHtml(productTitle)}</strong>${creatorName ? ` from ${escapeHtml(creatorName)}` : ''} has ended and access has been removed.</p>` +
            (reason ? `<p style="margin:0;padding:14px;background:#fff8f0;border-radius:10px;color:#555">${escapeHtml(reason)}</p>` : '') +
            muted('Want back in? Visit the creator&apos;s store to re-subscribe.'),
          { preheader: `Your ${productTitle} membership has ended.` },
        ),
        text: `Your subscription to ${productTitle} has ended.${reason ? `\n\n${reason}` : ''}`,
      };
    }
    case 'creator_membership_cancelled': {
      const { creatorName, productTitle, buyerEmail, buyerName, leadsUrl } =
        data as TemplateData['creator_membership_cancelled'];
      return {
        subject: `Membership cancelled: ${productTitle}`,
        html: layout(
          'Member cancelled',
          `<p style="margin:0 0 16px">A member cancelled (or their subscription ended) on <strong>${escapeHtml(creatorName)}</strong>.</p>
${detailTable(infoRow('Membership', productTitle) + infoRow('Member', buyerName) + infoRow('Email', buyerEmail))}
${button(leadsUrl, 'View contacts')}`,
          { preheader: `${buyerName} left ${productTitle}.` },
        ),
        text: `${buyerName} (${buyerEmail}) cancelled ${productTitle}.\n\nView contacts: ${leadsUrl}`,
      };
    }
    case 'membership_payment_failed': {
      const { productTitle, amount, creatorName, updatePaymentUrl } =
        data as TemplateData['membership_payment_failed'];
      return {
        subject: `Payment failed: ${productTitle}`,
        html: layout(
          'Payment failed',
          `<p style="margin:0 0 16px">We couldn&apos;t process your <strong>${escapeHtml(amount)}</strong> payment for <strong>${escapeHtml(productTitle)}</strong>${creatorName ? ` from ${escapeHtml(creatorName)}` : ''}.</p>
<p style="margin:0 0 16px">Please update your payment method to keep your access active.</p>` +
            (updatePaymentUrl ? button(updatePaymentUrl, 'Update payment method') : '') +
            muted('If you believe this is an error, contact the creator or your bank.'),
          { preheader: `Action needed — payment for ${productTitle} failed.` },
        ),
        text: `Payment of ${amount} for ${productTitle} failed.${updatePaymentUrl ? `\n\nUpdate payment: ${updatePaymentUrl}` : ''}`,
      };
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

function resolveFromAddress(fromName?: string): string {
  if (!fromName) return env.EMAIL_FROM;
  const match = env.EMAIL_FROM.match(/<([^>]+)>/);
  const email = match?.[1] ?? env.EMAIL_FROM;
  return `${fromName} via CreatorStore <${email}>`;
}

export async function deliverEmail(
  to: string,
  email: RenderedEmail,
  options: DeliverOptions = {},
): Promise<void> {
  if (!resend) {
    logger.info(
      { to, subject: email.subject, fromName: options.fromName, preview: email.text.slice(0, 200) },
      '[email:dev] not sent (Resend unconfigured)',
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: resolveFromAddress(options.fromName),
    to,
    replyTo: options.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) {
    logger.error({ to, subject: email.subject, err: error.message }, 'Resend delivery failed');
    throw new Error(`Resend error: ${error.message}`);
  }
  logger.debug({ to, subject: email.subject }, 'Email sent');
}
