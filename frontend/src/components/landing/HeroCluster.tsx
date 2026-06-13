'use client';

import { useEffect, useRef } from 'react';

/**
 * Stan hero phone-cluster. Each scraped PNG is a full-canvas export with its
 * element already positioned within a shared coordinate space, so the layers
 * are stacked at the same origin (top-left, full width) and compose into the
 * exact cluster from the live site. Every layer drifts slightly with the
 * pointer (parallax) and floats gently; motion is disabled for reduced-motion.
 */

type Layer = {
  src: string;
  /** parallax depth — higher = moves more with the pointer */
  depth: number;
  /** float animation duration (s) for subtle idle motion */
  float: number;
};

// Back-to-front paint order, matching the live site's DOM:
// phone, phone, bubble, bubble, bubble, card, card, card.
const LAYERS: Layer[] = [
  { src: '/stan/hero-1.png', depth: 4, float: 8 }, // back phone (checkout)
  { src: '/stan/hero-2.png', depth: 5, float: 9 }, // front phone (Alexandra Silva)
  { src: '/stan/hero-8.png', depth: 18, float: 7 }, // COURSES bubble (right)
  { src: '/stan/hero-6.png', depth: 20, float: 6.5 }, // CALENDAR bubble (left)
  { src: '/stan/hero-7.png', depth: 22, float: 7.5 }, // DOWNLOADS bubble (lower-left)
  { src: '/stan/hero-3.png', depth: 12, float: 6 }, // My Creator Course card
  { src: '/stan/hero-4.png', depth: 14, float: 6.8 }, // 1:1 Coaching card
  { src: '/stan/hero-5.png', depth: 16, float: 7.2 }, // Download My Guide card
];

export function HeroCluster() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let mx = 0;
    let my = 0;

    const apply = () => {
      raf = 0;
      el.querySelectorAll<HTMLElement>('[data-depth]').forEach((layer) => {
        const depth = Number(layer.dataset.depth) || 0;
        layer.style.transform = `translate3d(${mx * depth}px, ${my * depth}px, 0)`;
      });
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 0.1; // -1..1
      my = ((e.clientY - r.top) / r.height - 0.5) * 0.1;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-[1453/1657] w-full max-w-[560px] select-none"
      aria-hidden="true"
    >
      {LAYERS.map((l, i) => (
        // Outer wrapper = parallax translate (driven by JS); inner img = idle float.
        <div
          key={i}
          data-depth={l.depth}
          className="absolute inset-0"
          style={{ transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)' }}
        >
          <img
            src={l.src}
            alt=""
            className="absolute left-0 top-0 w-full"
            style={{ animation: `float ${l.float}s ease-in-out infinite` }}
          />
        </div>
      ))}
    </div>
  );
}
