'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StoreTemplate } from '@/storefront/templates/types';
import { themePreviewSrc } from '@/storefront/templates/previews';
import { IconChevronLeft, IconChevronRight } from '@/components/icons';
import { cn } from '@/lib/cn';

const THEME_LABELS: Record<string, string> = {
  studio: 'Studio',
  midnight: 'Midnight',
  blush: 'Blush',
  violet: 'Violet',
  wellness: 'Wellness',
  pastel: 'Pastel',
  noir: 'Noir',
  editorial: 'Editorial',
  bloom: 'Bloom',
  ocean: 'Ocean',
};

function themeLabel(t: StoreTemplate) {
  return THEME_LABELS[t.id] ?? t.name;
}

function circularOffset(index: number, active: number, length: number): number {
  let diff = index - active;
  if (diff > length / 2) diff -= length;
  if (diff < -length / 2) diff += length;
  return diff;
}

function carouselStyle(offset: number): React.CSSProperties {
  const abs = Math.abs(offset);
  const scale = offset === 0 ? 1 : abs === 1 ? 0.84 : 0.7;
  const x = offset * 158;
  const rotateY = offset * -22;
  const opacity = offset === 0 ? 1 : abs === 1 ? 0.82 : 0.45;
  const zIndex = 20 - abs;
  const blur = abs === 2 ? 'blur(0.4px)' : 'none';

  return {
    transform: `translate(calc(-50% + ${x}px), -50%) scale(${scale}) rotateY(${rotateY}deg)`,
    opacity,
    zIndex,
    filter: blur,
  };
}

/** Phone frame showing the reference screenshot for each theme. */
function ThemePreviewPhone({ template, featured }: { template: StoreTemplate; featured?: boolean }) {
  const src = themePreviewSrc(template.id, template.previewImage);

  return (
    <div
      className={cn(
        'pointer-events-none select-none overflow-hidden rounded-[1.75rem] bg-[#141414] p-[6px] transition-shadow duration-500',
        featured
          ? 'shadow-[0_28px_56px_-20px_rgba(88,101,242,0.35),0_12px_24px_-8px_rgba(15,15,25,0.2)]'
          : 'shadow-[0_16px_40px_-16px_rgba(15,15,25,0.28)]',
      )}
      style={{ width: 210, height: 374 }}
    >
      <div className="relative h-full overflow-hidden rounded-[1.4rem] bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover object-top"
          draggable={false}
        />
        {/* Subtle inner bezel highlight */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[1.4rem] ring-1 ring-inset ring-white/10"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function ThemeCarousel({
  templates,
  activeId,
  onSelect,
}: {
  templates: StoreTemplate[];
  activeId: string;
  onSelect: (t: StoreTemplate) => void;
}) {
  const activeIndex = Math.max(0, templates.findIndex((t) => t.id === activeId));
  const [index, setIndex] = useState(activeIndex >= 0 ? activeIndex : 0);

  useEffect(() => {
    const i = templates.findIndex((t) => t.id === activeId);
    if (i >= 0) setIndex(i);
  }, [activeId, templates]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = (i + delta + templates.length) % templates.length;
        onSelect(templates[next]);
        return next;
      });
    },
    [onSelect, templates],
  );

  const current = templates[index];

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#f7f8fc] to-transparent px-2 pb-2 pt-4">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-30 w-16 bg-gradient-to-r from-[#f7f8fc] to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-30 w-16 bg-gradient-to-l from-[#f7f8fc] to-transparent"
          aria-hidden="true"
        />

        <div
          className="relative mx-auto h-[400px] w-full max-w-[760px]"
          style={{ perspective: '1600px' }}
        >
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {templates.map((t, i) => {
              const offset = circularOffset(i, index, templates.length);
              if (Math.abs(offset) > 2) return null;
              const isCenter = offset === 0;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (!isCenter) {
                      setIndex(i);
                      onSelect(t);
                    }
                  }}
                  className={cn(
                    'absolute left-1/2 top-1/2 will-change-transform',
                    'transition-[transform,opacity,filter] duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                    !isCenter && 'cursor-pointer hover:opacity-95',
                  )}
                  style={carouselStyle(offset)}
                  aria-label={`Select ${themeLabel(t)} theme`}
                  aria-current={isCenter ? 'true' : undefined}
                >
                  <ThemePreviewPhone template={t} featured={isCenter} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-9 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white hover:text-brand-600 hover:shadow-soft"
          aria-label="Previous theme"
        >
          <IconChevronLeft size={20} />
        </button>
        <span className="min-w-[100px] text-center text-[15px] font-semibold tracking-tight text-ink">
          {current ? themeLabel(current) : ''}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white hover:text-brand-600 hover:shadow-soft"
          aria-label="Next theme"
        >
          <IconChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
