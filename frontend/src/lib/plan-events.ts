/**
 * Broadcast a plan change so any mounted UI that gates on the current plan
 * (e.g. the dashboard sidebar locks) can refetch entitlements immediately —
 * without a full page reload.
 */
export const PLAN_CHANGED_EVENT = 'cs:plan-changed';

export function emitPlanChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
}
