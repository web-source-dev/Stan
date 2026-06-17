// Persisted sidebar feature toggles, managed from the "More Options" page.
// These features show in the sidebar when enabled (default: all on).

export const MORE_FEATURE_KEYS = ['appointments', 'referrals', 'emails', 'autodm'] as const;
export type FeatureKey = (typeof MORE_FEATURE_KEYS)[number];

const STORAGE_KEY = 'stan:enabledFeatures';
const EVENT = 'stan:navprefs';

export function getEnabledFeatures(): Set<string> {
  if (typeof window === 'undefined') return new Set(MORE_FEATURE_KEYS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(MORE_FEATURE_KEYS); // default: all enabled
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(MORE_FEATURE_KEYS);
  }
}

export function setFeatureEnabled(key: string, on: boolean): void {
  const cur = getEnabledFeatures();
  if (on) cur.add(key);
  else cur.delete(key);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cur]));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export const NAVPREFS_EVENT = EVENT;
