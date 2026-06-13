'use client';

import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react';
import { cn } from '@/lib/cn';

/**
 * Reveal-on-scroll wrapper. Adds `.reveal` (hidden + offset) and flips to
 * `.is-visible` the first time the element enters the viewport. Optional
 * `delay` (ms) staggers siblings. Honors reduced-motion via the CSS rule in
 * globals.css, which forces `.reveal` visible.
 */
export function Reveal({
  children,
  className = '',
  delay = 0,
  as: TagProp = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  // Polymorphic tag — cast so JSX doesn't collapse the spread props to `never`
  // or blow up into an oversized intrinsic-element union.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag = TagProp as any;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn('reveal', visible && 'is-visible', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
