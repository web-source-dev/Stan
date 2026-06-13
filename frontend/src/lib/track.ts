import { API_URL } from './api';

type EventType = 'view' | 'cta_click' | 'product_click' | 'checkout_start' | 'lead_submit';

/** Stable-ish anonymous id for funnel de-duplication (not PII). */
function anonId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('cs_anon');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('cs_anon', id);
    }
    return id;
  } catch {
    return '';
  }
}

/** Fire-and-forget analytics beacon; never throws, never blocks navigation. */
export function track(username: string, type: EventType): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({ username, type, anonId: anonId(), path: window.location.pathname });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_URL}/api/events`, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* ignore */
  }
}
