import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  defaultEmailFlowSteps,
  type ProductCustomField,
  type ProductEmailFlowStep,
} from '@/lib/product-options';
import { BOOKING_TIMEZONES } from '@/lib/booking-types';

export interface WebinarSlot {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24h) */
  time: string;
}

export interface WebinarEditorState {
  id?: string;
  title: string;
  shortDescription: string;
  description: string;
  bottomTitle: string;
  ctaLabel: string;
  thumbnailButtonLabel: string;
  coverImageUrl: string;
  coverPublicId: string;
  thumbnailStyle: 'button' | 'callout' | 'preview';
  priceDollars: string;
  discountPriceDollars: string;
  discountEnabled: boolean;
  slots: WebinarSlot[];
  durationMin: number;
  timezone: string;
  calendarIntegration: string;
  capacityPerSlot: string;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  customFields: ProductCustomField[];
  emailFlows: ProductEmailFlowStep[];
  confirmSubject: string;
  confirmBody: string;
  meetingUrl: string;
  replayUrl: string;
}

export const WEBINAR_TIMEZONES = BOOKING_TIMEZONES;
export const WEBINAR_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
export const WEBINAR_CALENDAR_OPTIONS = [{ value: 'default', label: 'Default' }];
export const WEBINAR_REMINDER_HOURS = [1, 2, 6, 12, 24, 48];

export function generateWebinarDescription(): string {
  return `I am here to connect with you and give you a sense of community.\n\n**During this webinar, you will:**\n• Receive specific advice on a unique subject\n• Create a list of actionable steps to improve your life\n• Find a sense of community to improve your network and results`;
}


export function slotStartsAt(slot: Pick<WebinarSlot, 'date' | 'time'>): Date {
  return new Date(`${slot.date}T${slot.time}:00`);
}

export function formatSlotDateLabel(date: string): string {
  if (!date) return 'Select date';
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSlotTimeLabel(time: string): string {
  if (!time) return 'Select time';
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function getUpcomingSlots(slots: WebinarSlot[]): WebinarSlot[] {
  const now = Date.now();
  return slots
    .filter((s) => s.date && s.time && slotStartsAt(s).getTime() > now)
    .sort((a, b) => slotStartsAt(a).getTime() - slotStartsAt(b).getTime());
}

export function timezonePreviewLabel(tz: string): string {
  return WEBINAR_TIMEZONES.find((z) => z.value === tz)?.label.split('|')[0]?.trim() ?? tz.replace('_', '/');
}

export function buildInitialWebinar(): WebinarEditorState {
  return {
    title: 'Join Me at the Webinar',
    shortDescription: 'Grab a spot in my exclusive webinar!',
    description: generateWebinarDescription(),
    bottomTitle: 'Join Me & Friends',
    ctaLabel: 'Secure Your Spot',
    thumbnailButtonLabel: 'Claim Your Spot',
    coverImageUrl: '',
    coverPublicId: '',
    thumbnailStyle: 'callout',
    priceDollars: '9.99',
    discountPriceDollars: '',
    discountEnabled: false,
    slots: [],
    durationMin: 30,
    timezone: 'Asia/Shanghai',
    calendarIntegration: 'default',
    capacityPerSlot: '50',
    reminderEnabled: true,
    reminderHoursBefore: 24,
    customFields: [],
    emailFlows: defaultEmailFlowSteps().map((s, i) => ({ ...s, id: `step_${i}` })),
    confirmSubject: 'Your webinar spot is confirmed',
    confirmBody: DEFAULT_CONFIRM_BODY,
    meetingUrl: '',
    replayUrl: '',
  };
}

export type ApiWebinar = {
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  priceCents: number;
  discountPriceCents?: number;
  discountEnabled?: boolean;
  coverImageUrl?: string;
  coverPublicId?: string;
  thumbnailStyle?: 'button' | 'callout' | 'preview';
  thumbnailButtonLabel?: string;
  bottomTitle?: string;
  ctaLabel?: string;
  slots?: { id: string; startsAt: string }[];
  durationMin?: number;
  timezone?: string;
  calendarIntegration?: string;
  capacityPerSlot?: number;
  reminderEnabled?: boolean;
  reminderHoursBefore?: number;
  emailFlows?: { id: string; dayOffset: number; subject: string; body: string; enabled: boolean }[];
  customFields?: { id: string; label: string; type: 'text' | 'textarea' | 'phone'; required: boolean }[];
  confirmSubject?: string;
  confirmBody?: string;
  meetingUrl?: string;
  replayUrl?: string;
  status?: string;
};

export function webinarFromApi(w: ApiWebinar): WebinarEditorState {
  return {
    id: w.id,
    title: w.title,
    shortDescription: w.shortDescription ?? '',
    description: w.description ?? '',
    bottomTitle: w.bottomTitle ?? 'Join Me & Friends',
    ctaLabel: w.ctaLabel ?? 'Secure Your Spot',
    thumbnailButtonLabel: w.thumbnailButtonLabel ?? 'Claim Your Spot',
    coverImageUrl: w.coverImageUrl ?? '',
    coverPublicId: w.coverPublicId ?? '',
    thumbnailStyle: w.thumbnailStyle ?? 'callout',
    priceDollars: (w.priceCents / 100).toFixed(2),
    discountPriceDollars: w.discountPriceCents ? (w.discountPriceCents / 100).toFixed(2) : '',
    discountEnabled: Boolean(w.discountEnabled),
    slots: (w.slots ?? []).map((s) => {
      const d = new Date(s.startsAt);
      const date = d.toISOString().slice(0, 10);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return { id: s.id, date, time };
    }),
    durationMin: w.durationMin ?? 30,
    timezone: w.timezone ?? 'Asia/Shanghai',
    calendarIntegration: w.calendarIntegration ?? 'default',
    capacityPerSlot: w.capacityPerSlot ? String(w.capacityPerSlot) : '50',
    reminderEnabled: w.reminderEnabled ?? true,
    reminderHoursBefore: w.reminderHoursBefore ?? 24,
    customFields: (w.customFields ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
    })),
    emailFlows: (w.emailFlows ?? []).map((s) => ({
      id: s.id,
      dayOffset: s.dayOffset,
      subject: s.subject,
      body: s.body,
      enabled: s.enabled,
    })),
    confirmSubject: w.confirmSubject ?? DEFAULT_CONFIRM_SUBJECT,
    confirmBody: w.confirmBody ?? DEFAULT_CONFIRM_BODY,
    meetingUrl: w.meetingUrl ?? '',
    replayUrl: w.replayUrl ?? '',
  };
}

export function buildWebinarBody(form: WebinarEditorState) {
  const priceCents = Math.round(parseFloat(form.priceDollars || '0') * 100);
  const discountPriceCents =
    form.discountEnabled && form.discountPriceDollars
      ? Math.round(parseFloat(form.discountPriceDollars || '0') * 100)
      : 0;

  return {
    title: form.title,
    shortDescription: form.shortDescription,
    description: form.description || form.shortDescription,
    priceCents,
    coverImageUrl: form.coverImageUrl,
    coverPublicId: form.coverPublicId,
    discountPriceCents,
    discountEnabled: form.discountEnabled,
    thumbnailStyle: form.thumbnailStyle,
    thumbnailButtonLabel: form.thumbnailButtonLabel,
    bottomTitle: form.bottomTitle,
    ctaLabel: form.ctaLabel,
    slots: form.slots
      .filter((s) => s.date && s.time)
      .map((s) => ({ startsAt: slotStartsAt(s).toISOString() })),
    durationMin: form.durationMin,
    timezone: form.timezone,
    calendarIntegration: form.calendarIntegration,
    capacityPerSlot: parseInt(form.capacityPerSlot || '50', 10) || 50,
    reminderEnabled: form.reminderEnabled,
    reminderHoursBefore: form.reminderHoursBefore,
    emailFlows: form.emailFlows.map(({ dayOffset, subject, body, enabled }) => ({
      dayOffset,
      subject,
      body,
      enabled,
    })),
    customFields: form.customFields.map(({ label, type, required }) => ({ label, type, required })),
    confirmSubject: form.confirmSubject,
    confirmBody: form.confirmBody,
    meetingUrl: form.meetingUrl,
    replayUrl: form.replayUrl,
  };
}
