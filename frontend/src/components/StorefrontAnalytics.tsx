'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';

/** Fires a single page-view beacon for the storefront on mount. */
export function StorefrontAnalytics({ username }: { username: string }) {
  useEffect(() => {
    track(username, 'view');
  }, [username]);
  return null;
}
