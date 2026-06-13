'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The "0% Transaction Fees" callout. A hand-drawn ellipse is stroked around the
 * "0%" using an SVG path that draws itself in (stroke-dashoffset) the first time
 * the element scrolls into view. Reduced-motion shows the circle already drawn.
 */
export function ZeroFee() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // A single clean, slightly over-shooting marker loop around the "0%".
  const path =
    'M208 62 C208 31 168 16 118 16 C58 16 22 36 22 64 C22 90 66 102 120 102 C182 102 214 84 206 50';
  const LEN = 480;

  return (
    <div ref={ref} className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
      <div className="relative inline-flex items-center justify-center px-6 py-2">
        <span className="font-display text-7xl font-extrabold tracking-tight text-ink sm:text-8xl">0%</span>
        <svg
          viewBox="0 0 230 118"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          fill="none"
          aria-hidden
        >
          <path
            d={path}
            stroke="#f5b301"
            strokeWidth={6}
            strokeLinecap="round"
            style={{
              strokeDasharray: LEN,
              strokeDashoffset: drawn ? 0 : LEN,
              transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </svg>
      </div>
      <p className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Transaction Fees, Always.
      </p>
    </div>
  );
}
