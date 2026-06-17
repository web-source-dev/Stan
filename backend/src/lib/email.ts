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
  | 'customer_login_code';

interface TemplateData {
  email_verification: { verifyUrl: string };
  password_reset: { resetUrl: string };
  password_changed: Record<string, never>;
  purchase_receipt: {
    productTitle: string;
    amount: string;
    fulfilmentUrl: string;
    thankYouMessage?: string;
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
  };
  customer_login_code: {
    code: string;
    creatorName: string;
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
      const { productTitle, amount, fulfilmentUrl, thankYouMessage } =
        data as TemplateData['purchase_receipt'];
      return {
        subject: `Your purchase: ${productTitle}`,
        html: layout(
          'Thanks for your purchase',
          `<p>You bought <strong>${productTitle}</strong> for ${amount}.</p>` +
            (thankYouMessage ? `<p>${thankYouMessage}</p>` : '') +
            `<p>${button(fulfilmentUrl, 'Access your purchase')}</p>` +
            `<p style="color:#888;font-size:12px">Keep this email — you can return to this link anytime to re-download.</p>`,
        ),
        text:
          `Thanks for buying ${productTitle} (${amount}). Access your purchase: ${fulfilmentUrl}` +
          (thankYouMessage ? `\n\n${thankYouMessage}` : ''),
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
      const { title, whenText, meetingUrl, manageUrl } = data as TemplateData['booking_confirmation'];
      return {
        subject: `Booking confirmed: ${title}`,
        html: layout(
          'Your booking is confirmed',
          `<p><strong>${title}</strong></p><p>${whenText}</p>` +
            (meetingUrl ? `<p>${button(meetingUrl, 'Join the meeting')}</p>` : '') +
            `<p style="font-size:13px"><a href="${manageUrl}">Reschedule or cancel</a></p>`,
        ),
        text: `Booking confirmed: ${title}\n${whenText}` +
          (meetingUrl ? `\nMeeting: ${meetingUrl}` : '') +
          `\nManage: ${manageUrl}`,
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
