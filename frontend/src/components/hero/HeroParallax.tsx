'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import {
  IconCalendar,
  IconBook,
  IconBox,
  IconBolt,
  IconCheck,
} from '@/components/icons';

/**
 * Stan-style hero visual: a tilted phone storefront with circular icon badges
 * and floating UI cards clustered tightly around it. The phone is the anchor —
 * every badge hangs off its edges with absolute offsets, so the composition
 * stays together at any container height (it never drifts to the top or bleeds
 * into the headline column).
 *
 * Each floating element carries `data-depth`; on pointer move the cluster
 * parallaxes, deeper elements moving more. Falls back to a static (still gently
 * floating) layout under reduced-motion.
 */
export function HeroParallax() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      ty = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    };
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      wrap.querySelectorAll<HTMLElement>('[data-depth]').forEach((el) => {
        const d = parseFloat(el.dataset.depth || '0');
        el.style.transform = `translate3d(${cx * d * 22}px, ${cy * d * 22}px, 0)`;
      });
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const float = (cls: string) => (reduced ? '' : cls);

  return (
    <div ref={wrapRef} className="relative grid h-[440px] w-full place-items-center [perspective:1600px] sm:h-[460px]">
      {/* Cluster: the phone is the anchor; everything hangs off its edges. */}
      <div className="relative">
        {/* Phone */}
        <div data-depth="0.25" className="relative z-10 [transform-style:preserve-3d]">
          <div className="relative w-[244px] rounded-[2.4rem] border border-black/10 bg-white p-2.5 shadow-[0_30px_70px_-20px_rgba(20,16,80,0.6)] [transform:rotateY(-13deg)_rotateX(7deg)_rotate(-2deg)]">
            <div className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black/85" />
            <div className="overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-brand-600 to-brand-500 pb-4">
              <div className="px-5 pb-4 pt-9 text-center text-white">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20 text-lg font-bold ring-2 ring-white/40">
                  M
                </div>
                <div className="mt-2 text-sm font-bold">Maya Rivera</div>
                <div className="text-[11px] text-white/80">Fitness coach</div>
                <div className="mt-2 flex justify-center gap-1.5 text-white/85">
                  {['IG', 'YT', 'X', 'TT'].map((s) => (
                    <span key={s} className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[8px] font-semibold">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-t-[1.4rem] bg-white px-3 pt-3">
                <div className="rounded-xl border border-line bg-white p-2.5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold">12-Week Strength Plan</span>
                    <span className="text-[11px] font-bold">$49</span>
                  </div>
                  <div className="mt-2 rounded-md bg-brand-gradient py-1.5 text-center text-[10px] font-semibold text-white">
                    Buy now
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-white p-2.5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold">1:1 Coaching Call</span>
                    <span className="text-[11px] font-bold">$120</span>
                  </div>
                  <div className="mt-1 text-[9px] text-neutral-500">30 min · video call</div>
                </div>
                <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-2 text-center text-[10px] font-medium text-brand-700">
                  Free macro guide → join the list
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Circular badges — hugging the phone's left/right edges */}
        <Badge className={float('animate-float')} style={{ top: '-22px', left: '-46px' }} depth={1.2} icon={<IconCalendar size={20} />} label="Calendar" />
        <Badge className={float('animate-float-slow')} style={{ top: '96px', left: '-72px' }} depth={1.45} icon={<IconBox size={20} />} label="Products" />
        <Badge className={float('animate-float-slow')} style={{ top: '40px', right: '-44px' }} depth={1.1} icon={<IconBook size={20} />} label="Courses" />

        {/* Floating UI chips — close to the phone, never over the headline */}
        <div
          data-depth="1.6"
          style={{ top: '8px', right: '-30px' }}
          className={`absolute z-20 rounded-xl border border-line bg-white/95 px-3 py-2 shadow-lift backdrop-blur ${float('animate-float-slow')}`}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-success-50 text-success-600">
              <IconCheck size={13} />
            </span>
            <div>
              <div className="text-[10px] font-bold leading-tight">New sale · $49</div>
              <div className="text-[9px] text-neutral-500">Booked by Odile</div>
            </div>
          </div>
        </div>

        <div
          data-depth="1.75"
          style={{ bottom: '34px', left: '-58px' }}
          className={`absolute z-20 rounded-xl border border-line bg-white/95 px-3 py-2 shadow-lift backdrop-blur ${float('animate-float')}`}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-white">
              <IconBolt size={13} />
            </span>
            <div className="text-[10px] font-bold leading-tight">
              Conversion <span className="text-brand-600">+38%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
  style,
  depth,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  style: React.CSSProperties;
  depth: number;
  className?: string;
}) {
  return (
    <div data-depth={depth} style={style} className={`absolute z-20 ${className}`}>
      <div className="flex flex-col items-center gap-1">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white text-brand-600 shadow-lift">
          {icon}
        </div>
        <span className="rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500 shadow-xs backdrop-blur">
          {label}
        </span>
      </div>
    </div>
  );
}
