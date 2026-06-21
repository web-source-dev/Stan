'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PLAN_CHANGED_EVENT } from '@/lib/plan-events';

export interface PlanFeatures {
  maxProducts: number | null;
  maxStorageBytes: number | null;
  courses: boolean;
  bookings: boolean;
  email: boolean;
  landingPages: boolean;
  autodm: boolean;
  stanleyAI: boolean;
  removeBranding: boolean;
  pricingTools: boolean;
  orderBumps: boolean;
  customFields: boolean;
  affiliate: boolean;
  advancedAnalytics: boolean;
}

interface PlanState {
  tier: string;
  features: PlanFeatures;
}

// Module-level cache so the (frequent) feature checks across the dashboard share
// a single fetch and update together when the plan changes.
let cache: PlanState | null = null;

/**
 * Current plan tier + the features it unlocks. Fetches once, caches, and
 * refetches whenever the plan changes (PLAN_CHANGED_EVENT) so gated UI updates
 * live after an upgrade/downgrade.
 */
export function usePlan(): { tier: string | null; features: PlanFeatures | null; loading: boolean } {
  const { authedRequest } = useAuth();
  const [state, setState] = useState<PlanState | null>(cache);
  // `fresh` = this hook instance has completed a fetch on THIS mount. We always
  // revalidate on mount (the cache may be stale from an earlier plan), and gates
  // wait for a fresh result so they never show content based on a stale plan.
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchPlan = () =>
      authedRequest<{ subscription: PlanState }>('/api/subscription')
        .then((r) => {
          cache = { tier: r.subscription.tier, features: r.subscription.features };
          if (alive) { setState(cache); setFresh(true); }
        })
        .catch(() => { if (alive) setFresh(true); });
    void fetchPlan(); // always revalidate on mount, not just when cache is empty
    const onChange = () => { if (alive) setFresh(false); void fetchPlan(); };
    window.addEventListener(PLAN_CHANGED_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(PLAN_CHANGED_EVENT, onChange);
    };
  }, [authedRequest]);

  return { tier: state?.tier ?? null, features: state?.features ?? null, loading: !fresh };
}
