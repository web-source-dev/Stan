/** Defaults for Settings → Email Notifications (all enabled). */
export const NOTIFICATION_PREF_DEFAULTS = {
  calendarBookings: true,
  ordersFulfillment: true,
  purchaseConfirmations: true,
  leadCaptured: true,
  membershipCancellations: true,
  recurringPayments: true,
} as const;

export type NotificationPrefKey = keyof typeof NOTIFICATION_PREF_DEFAULTS;

export function normalizeNotificationPrefs(
  prefs: Record<string, boolean | undefined> | null | undefined,
): Record<NotificationPrefKey, boolean> {
  const out: Record<NotificationPrefKey, boolean> = { ...NOTIFICATION_PREF_DEFAULTS };
  if (!prefs) return out;
  for (const key of Object.keys(NOTIFICATION_PREF_DEFAULTS) as NotificationPrefKey[]) {
    if (typeof prefs[key] === 'boolean') out[key] = prefs[key]!;
  }
  return out;
}

export function isNotificationPrefEnabled(
  prefs: Record<string, boolean | undefined> | null | undefined,
  key: NotificationPrefKey,
): boolean {
  return normalizeNotificationPrefs(prefs)[key];
}
