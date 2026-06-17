import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  defaultEmailFlowSteps,
  type ProductEmailFlowStep,
} from '@/lib/product-options';

export interface WeeklyTimeSlot {
  id: string;
  start: string;
  end: string;
}

export interface WeeklyDaySchedule {
  enabled: boolean;
  slots: WeeklyTimeSlot[];
}

export interface BookingEditorState {
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
  durationMin: number;
  timezone: string;
  calendarLabel: string;
  minNoticeHours: string;
  maxHorizonDays: string;
  maxAttendees: string;
  bufferBeforeEnabled: boolean;
  bufferAfterEnabled: boolean;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  meetingUrl: string;
  weeklySchedule: Record<number, WeeklyDaySchedule>;
  customFields: { id?: string; label: string; type: 'text' | 'textarea' | 'phone'; required: boolean }[];
  emailFlows: ProductEmailFlowStep[];
  confirmSubject: string;
  confirmBody: string;
}

export const BOOKING_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Shanghai', label: 'CST — Hong Kong, Macau, Shanghai | UTC +8' },
  { value: 'America/New_York', label: 'EST — New York | UTC -5' },
  { value: 'America/Los_Angeles', label: 'PST — Los Angeles | UTC -8' },
  { value: 'America/Chicago', label: 'CST — Chicago | UTC -6' },
  { value: 'Europe/London', label: 'GMT — London | UTC +0' },
  { value: 'Europe/Paris', label: 'CET — Paris, Berlin | UTC +1' },
  { value: 'UTC', label: 'UTC' },
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
export const BUFFER_OPTIONS = [5, 10, 15, 30];
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function defaultWeeklySchedule(): BookingEditorState['weeklySchedule'] {
  return Object.fromEntries(
    WEEKDAY_LABELS.map((_, i) => [
      i,
      {
        enabled: i >= 1 && i <= 5,
        slots: [{ id: `slot_${i}_0`, start: '09:00', end: '17:00' }],
      },
    ]),
  ) as BookingEditorState['weeklySchedule'];
}

export function generateCoachingDescription(title: string): string {
  void title;
  return 'I am here to help you achieve your goals. On this 1:1 Video Call, I will personally help you:\n• Give you specific advice to help you reach your goals\n• Build a plan to get you there faster\n• Walk you through anything you need help with';
}

export function weeklyScheduleFromWindows(
  windows: { weekday: number; startMinute: number; endMinute: number }[],
): BookingEditorState['weeklySchedule'] {
  const schedule = Object.fromEntries(
    WEEKDAY_LABELS.map((_, i) => [
      i,
      { enabled: false, slots: [{ id: `slot_${i}_0`, start: '09:00', end: '17:00' }] },
    ]),
  ) as BookingEditorState['weeklySchedule'];

  const grouped = new Map<number, { start: string; end: string }[]>();
  for (const w of windows) {
    const list = grouped.get(w.weekday) ?? [];
    list.push({ start: minutesToTime(w.startMinute), end: minutesToTime(w.endMinute) });
    grouped.set(w.weekday, list);
  }

  for (const [day, slots] of grouped) {
    schedule[day] = {
      enabled: true,
      slots: slots.map((s, i) => ({ id: `slot_${day}_${i}`, start: s.start, end: s.end })),
    };
  }
  return schedule;
}

export type ApiBookingType = {
  id: string;
  title: string;
  description?: string;
  shortDescription?: string;
  bottomTitle?: string;
  ctaLabel?: string;
  coverImageUrl?: string;
  coverPublicId?: string;
  thumbnailStyle?: 'button' | 'callout' | 'preview';
  thumbnailButtonLabel?: string;
  priceCents: number;
  discountPriceCents?: number;
  discountEnabled?: boolean;
  durationMin: number;
  timezone: string;
  calendarLabel?: string;
  minNoticeMin: number;
  maxHorizonDays: number;
  maxAttendees?: number;
  bufferBeforeEnabled?: boolean;
  bufferAfterEnabled?: boolean;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  meetingUrl?: string;
  weeklyWindows: { weekday: number; startMinute: number; endMinute: number }[];
  intakeQuestions?: string[];
  confirmSubject?: string;
  confirmBody?: string;
};

export function bookingFromApi(bt: ApiBookingType): BookingEditorState {
  return {
    id: bt.id,
    title: bt.title,
    shortDescription: bt.shortDescription ?? '',
    description: bt.description ?? '',
    bottomTitle: bt.bottomTitle ?? 'Work With Me 1:1',
    ctaLabel: bt.ctaLabel ?? 'Book a Call',
    thumbnailButtonLabel: bt.thumbnailButtonLabel ?? bt.title,
    coverImageUrl: bt.coverImageUrl ?? '',
    coverPublicId: bt.coverPublicId ?? '',
    thumbnailStyle: bt.thumbnailStyle ?? 'callout',
    priceDollars: (bt.priceCents / 100).toString(),
    discountPriceDollars: bt.discountPriceCents ? (bt.discountPriceCents / 100).toString() : '',
    discountEnabled: Boolean(bt.discountEnabled && bt.discountPriceCents),
    durationMin: bt.durationMin,
    timezone: bt.timezone,
    calendarLabel: bt.calendarLabel ?? 'Default',
    minNoticeHours: String(Math.round(bt.minNoticeMin / 60)),
    maxHorizonDays: String(bt.maxHorizonDays),
    maxAttendees: String(bt.maxAttendees ?? 1),
    bufferBeforeEnabled: bt.bufferBeforeEnabled ?? false,
    bufferAfterEnabled: bt.bufferAfterEnabled ?? false,
    bufferBeforeMin: bt.bufferBeforeMin ?? 15,
    bufferAfterMin: bt.bufferAfterMin ?? 15,
    meetingUrl: bt.meetingUrl ?? '',
    weeklySchedule: weeklyScheduleFromWindows(bt.weeklyWindows ?? []),
    customFields: (bt.intakeQuestions ?? []).map((label, i) => ({
      id: `field_${i}`,
      label,
      type: 'text' as const,
      required: false,
    })),
    emailFlows: defaultEmailFlowSteps().map((s, i) => ({ ...s, id: `step_${i}` })),
    confirmSubject: bt.confirmSubject || DEFAULT_CONFIRM_SUBJECT,
    confirmBody: bt.confirmBody || DEFAULT_CONFIRM_BODY,
  };
}

export function buildInitialBooking(): BookingEditorState {
  return {
    title: 'Book a 1:1 Call with Me',
    shortDescription: 'Book a private coaching session with me!',
    description:
      'I am here to help you achieve your goals. On this 1:1 Video Call, I will personally help you:\n• Give you specific advice to help you reach your goals\n• Build a plan to get you there faster\n• Walk you through anything you need help with',
    bottomTitle: 'Work With Me 1:1',
    ctaLabel: 'Book a Call',
    thumbnailButtonLabel: 'Book a 1:1 Call with Me',
    coverImageUrl: '',
    coverPublicId: '',
    thumbnailStyle: 'callout',
    priceDollars: '9.99',
    discountPriceDollars: '',
    discountEnabled: false,
    durationMin: 30,
    timezone: 'Asia/Shanghai',
    calendarLabel: 'Default',
    minNoticeHours: '12',
    maxHorizonDays: '60',
    maxAttendees: '1',
    bufferBeforeEnabled: false,
    bufferAfterEnabled: false,
    bufferBeforeMin: 15,
    bufferAfterMin: 15,
    meetingUrl: '',
    weeklySchedule: defaultWeeklySchedule(),
    customFields: [],
    emailFlows: defaultEmailFlowSteps().map((s, i) => ({ ...s, id: `step_${i}` })),
    confirmSubject: DEFAULT_CONFIRM_SUBJECT,
    confirmBody: DEFAULT_CONFIRM_BODY,
  };
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function timezonePreviewLabel(tz: string): string {
  return BOOKING_TIMEZONES.find((z) => z.value === tz)?.label.split('|')[0]?.trim() ?? tz.replace('_', '/');
}
