import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

const resend = env.emailConfigured ? new Resend(env.RESEND_API_KEY) : null;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export type EmailTemplate =
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'purchase_receipt'
  | 'broadcast'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'customer_login_code'
  | 'login_code'
  | 'subscriber_welcome'
  | 'lead_captured';

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
  };
  booking_reminder: {
    title: string;
    whenText: string;
    startsInText: string;
    meetingUrl?: string;
    manageUrl: string;
    portalUrl?: string;
  };
  booking_cancelled: {
    title: string;
    whenText: string;
    reason?: string;
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
}

const layout = (title: string, body: string) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="color:#888;font-size:12px;margin-top:32px">CreatorStore</p>
  </div>`;

const button = (url: string, label: string) =>
  `<a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a>`;

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
          `<p>Confirm your email address to activate your CreatorStore account.</p><p>${button(verifyUrl, 'Verify email')}</p><p style="color:#888;font-size:12px">This link expires in 24 hours.</p>`,
        ),
        text: `Confirm your email address: ${verifyUrl} (expires in 24 hours)`,
      };
    }
    case 'password_reset': {
      const { resetUrl } = data as TemplateData['password_reset'];
      return {
        subject: 'Reset your CreatorStore password',
        html: layout(
          'Reset your password',
          `<p>We received a request to reset your password.</p><p>${button(resetUrl, 'Reset password')}</p><p style="color:#888;font-size:12px">If you didn't request this, you can ignore this email. This link expires in 1 hour.</p>`,
        ),
        text: `Reset your password: ${resetUrl} (expires in 1 hour). If you didn't request this, ignore this email.`,
      };
    }
    case 'purchase_receipt': {
      const { productTitle, amount, fulfilmentUrl, thankYouMessage, portalUrl } =
        data as TemplateData['purchase_receipt'];
      return {
        subject: `Your purchase: ${productTitle}`,
        html: layout(
          'Thanks for your purchase',
          `<p>You bought <strong>${productTitle}</strong> for ${amount}.</p>` +
            (thankYouMessage ? `<p>${thankYouMessage}</p>` : '') +
            `<p>${button(fulfilmentUrl, 'Access your purchase')}</p>` +
            `<p style="color:#888;font-size:12px">For your security, opening the link asks you to confirm this email address with a one-time code — so only you can access your files. Keep this email; you can return to the link anytime to re-download.</p>` +
            (portalUrl
              ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">` +
                `<p style="color:#555;font-size:13px;margin:0 0 10px">All your purchases from this creator in one place:</p>` +
                `${button(portalUrl, 'View all my purchases')}` +
                `<p style="color:#aaa;font-size:11px;margin-top:8px">Your email is pre-filled — just confirm it with a quick code.</p>` +
                `</div>`
              : ''),
        ),
        text:
          `Thanks for buying ${productTitle} (${amount}). Access your purchase: ${fulfilmentUrl}` +
          `\n\nFor your security, you'll confirm this email with a one-time code to unlock your files — so only you can open them.` +
          (thankYouMessage ? `\n\n${thankYouMessage}` : '') +
          (portalUrl ? `\n\nView all your purchases: ${portalUrl}` : ''),
      };
    }
    case 'broadcast': {
      const { subject, bodyHtml, bodyText, fromName, unsubscribeUrl } =
        data as TemplateData['broadcast'];
      const safeHtml = bodyHtml || bodyText.replace(/\n/g, '<br/>');
      const footer = unsubscribeUrl
        ? `<p style="color:#aaa;font-size:11px;margin-top:24px"><a href="${unsubscribeUrl}" style="color:#aaa">Unsubscribe</a></p>`
        : '';
      return {
        subject,
        html: layout(fromName || 'Update', `<div>${safeHtml}</div>${footer}`),
        text: unsubscribeUrl ? `${bodyText}\n\nUnsubscribe: ${unsubscribeUrl}` : bodyText,
      };
    }
    case 'booking_confirmation': {
      const { title, whenText, meetingUrl, manageUrl, portalUrl } = data as TemplateData['booking_confirmation'];
      return {
        subject: `Booking confirmed: ${title}`,
        html: layout(
          'Your booking is confirmed',
          `<p><strong>${title}</strong></p><p>${whenText}</p>` +
            (meetingUrl ? `<p>${button(meetingUrl, 'Join the meeting')}</p>` : '') +
            `<p style="font-size:13px"><a href="${manageUrl}">Reschedule or cancel</a></p>` +
            (portalUrl
              ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">` +
                `<p style="color:#555;font-size:13px;margin:0 0 10px">View all your purchases from this creator:</p>` +
                `${button(portalUrl, 'View my purchases')}` +
                `</div>`
              : ''),
        ),
        text: `Booking confirmed: ${title}\n${whenText}` +
          (meetingUrl ? `\nMeeting: ${meetingUrl}` : '') +
          `\nManage: ${manageUrl}` +
          (portalUrl ? `\n\nView all your purchases: ${portalUrl}` : ''),
      };
    }
    case 'customer_login_code': {
      const { code, creatorName } = data as TemplateData['customer_login_code'];
      return {
        subject: `Your ${creatorName} access code: ${code}`,
        html: layout(
          'Your login code',
          `<p>Use this code to access your purchases from <strong>${creatorName}</strong>:</p>` +
            `<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>` +
            `<p style="color:#888;font-size:12px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
        ),
        text: `Your ${creatorName} access code is ${code}. It expires in 10 minutes.`,
      };
    }
    case 'booking_reminder': {
      const { title, whenText, startsInText, meetingUrl, manageUrl, portalUrl } = data as TemplateData['booking_reminder'];
      return {
        subject: `Reminder: ${title} is ${startsInText}`,
        html: layout(
          'Your booking is coming up',
          `<p>This is a friendly reminder that <strong>${title}</strong> starts <strong>${startsInText}</strong>.</p>` +
            `<p>${whenText}</p>` +
            (meetingUrl ? `<p>${button(meetingUrl, 'Join the meeting')}</p>` : '') +
            `<p style="font-size:13px"><a href="${manageUrl}">Reschedule or cancel</a></p>` +
            (portalUrl
              ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">` +
                `<p style="color:#555;font-size:13px;margin:0 0 10px">View all your purchases from this creator:</p>` +
                `${button(portalUrl, 'View my purchases')}` +
                `</div>`
              : ''),
        ),
        text: `Reminder: ${title} is ${startsInText}.\n${whenText}` +
          (meetingUrl ? `\nMeeting: ${meetingUrl}` : '') +
          `\nManage: ${manageUrl}` +
          (portalUrl ? `\n\nView all your purchases: ${portalUrl}` : ''),
      };
    }
    case 'booking_cancelled': {
      const { title, whenText, reason } = data as TemplateData['booking_cancelled'];
      return {
        subject: `Booking cancelled: ${title}`,
        html: layout(
          'Your booking has been cancelled',
          `<p>Your booking for <strong>${title}</strong> (${whenText}) has been cancelled.</p>` +
            (reason ? `<p style="color:#555">${reason}</p>` : '') +
            `<p style="color:#888;font-size:12px">If you believe this was a mistake, please contact the creator directly.</p>`,
        ),
        text: `Your booking for ${title} (${whenText}) has been cancelled.` +
          (reason ? `\n\n${reason}` : '') +
          `\n\nIf you believe this was a mistake, please contact the creator directly.`,
      };
    }
    case 'login_code': {
      const { code } = data as TemplateData['login_code'];
      return {
        subject: `Your login code: ${code}`,
        html: layout(
          'Your login code',
          `<p>Use this code to finish signing in to your CreatorStore account:</p>` +
            `<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>` +
            `<p style="color:#888;font-size:12px">This code expires in 10 minutes. If you didn't try to log in, change your password.</p>`,
        ),
        text: `Your CreatorStore login code is ${code}. It expires in 10 minutes. If this wasn't you, change your password.`,
      };
    }
    case 'password_changed': {
      return {
        subject: 'Your CreatorStore password was changed',
        html: layout(
          'Password changed',
          `<p>Your password was just changed. If this wasn't you, reset your password immediately and contact support.</p>`,
        ),
        text: 'Your password was just changed. If this was not you, reset it immediately.',
      };
    }
    case 'subscriber_welcome': {
      const { creatorName, storefrontUrl, unsubscribeUrl, firstName } =
        data as TemplateData['subscriber_welcome'];
      const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
      const body =
        `<p>${greeting}</p>` +
        `<p>Thanks for subscribing to updates from <strong>${creatorName}</strong>. ` +
        `You'll be the first to hear about new drops, tips, and announcements.</p>` +
        `<p>${button(storefrontUrl, `Visit ${creatorName}'s store`)}</p>` +
        `<p style="color:#aaa;font-size:11px;margin-top:24px"><a href="${unsubscribeUrl}" style="color:#aaa">Unsubscribe</a></p>`;
      return {
        subject: `You're on ${creatorName}'s list`,
        html: layout(`Welcome to ${creatorName}'s list`, body),
        text:
          `${greeting}\n\nThanks for subscribing to updates from ${creatorName}. ` +
          `You'll be the first to hear about new drops, tips, and announcements.\n\n` +
          `Visit the store: ${storefrontUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
      };
    }
    case 'lead_captured': {
      const { creatorName, subscriberEmail, subscriberName, leadsUrl } =
        data as TemplateData['lead_captured'];
      return {
        subject: `New subscriber on ${creatorName}`,
        html: layout(
          'New email subscriber',
          `<p><strong>${subscriberName}</strong> (${subscriberEmail}) just subscribed on your storefront.</p>` +
            `<p>${button(leadsUrl, 'View contacts')}</p>`,
        ),
        text: `${subscriberName} (${subscriberEmail}) subscribed on your storefront.\n\nView contacts: ${leadsUrl}`,
      };
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

/** Deliver an email via Resend, or log it when email is not configured (dev). */
export async function deliverEmail(to: string, email: RenderedEmail): Promise<void> {
  if (!resend) {
    logger.info({ to, subject: email.subject, preview: email.text }, '[email:dev] not sent (Resend unconfigured)');
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
