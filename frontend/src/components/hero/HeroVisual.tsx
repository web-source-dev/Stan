'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { HeroFallback } from './HeroFallback';

/* The WebGL scene is heavy (~three.js). Load it only on the client, only when
   it's actually going to be shown, and stream the CSS mock in the meantime. */
const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => <HeroFallback />,
});

/** Cheap WebGL capability probe — avoids mounting a Canvas that can't render. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function HeroVisual() {
  const reduced = useReducedMotion();
  const [canRender3D, setCanRender3D] = useState<boolean | null>(null);

  useEffect(() => {
    setCanRender3D(hasWebGL());
  }, []);

  // SSR + first paint, or unsupported / reduced-motion → static mock.
  const show3D = canRender3D === true && !reduced;

  return (
    <div className="relative h-[420px] w-full sm:h-[480px] lg:h-[560px]">
      {/* Ambient glow that anchors the visual whether 2D or 3D renders. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gradient opacity-20 blur-[90px] animate-glow-pulse" />

      {show3D ? (
        <Scene />
      ) : (
        <div className="grid h-full place-items-center">
          <HeroFallback animate={!reduced} />
        </div>
      )}

      {/* Subtle "drag to look" affordance, only when interactive. */}
      {show3D && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line/70 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-500 backdrop-blur-md">
          Move your cursor to explore
        </div>
      )}
    </div>
  );
}
