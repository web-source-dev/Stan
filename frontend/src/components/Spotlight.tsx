'use client';

import { useRef, type ReactNode, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * Card with a cursor-following brand spotlight (see `.spotlight` in
 * globals.css). Updates `--mx` / `--my` CSS vars on pointer move so the glow
 * tracks the cursor. Purely decorative — degrades to a plain card on touch /
 * reduced-motion.
 */
export function Spotlight({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  return (
    <div ref={ref} onMouseMove={onMove} className={cn('spotlight', className)}>
      {children}
    </div>
  );
}
