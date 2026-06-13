'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting, reactively.
 * Returns `true` when the user has asked the OS to minimize motion — callers
 * should fall back to a static experience (no 3D, no ambient animation).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
