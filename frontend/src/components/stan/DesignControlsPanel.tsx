'use client';

import { useEffect, useRef, useState } from 'react';
import { FONT_PAIRS } from '@/storefront/runtime/theme';
import { IconChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

/** Shared control height — matches font dropdown row. */
const CONTROL_H = 'h-[50px]';

function normalizeHex(value: string, fallback: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  return fallback;
}

function ColorSwatch({
  value,
  onChange,
  fallback,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  fallback: string;
  label: string;
}) {
  const safe = normalizeHex(value, fallback);
  const isWhite = safe.toLowerCase() === '#ffffff';

  return (
    <label
      title={`${label}: ${safe}`}
      className={cn(
        'group relative block w-[50px] shrink-0 cursor-pointer rounded-xl transition',
        CONTROL_H,
        'ring-1 ring-inset',
        isWhite ? 'bg-white ring-line' : 'ring-black/[0.06]',
        'hover:ring-brand-300 hover:shadow-[0_4px_12px_-4px_rgba(88,101,242,0.35)]',
      )}
      style={{ backgroundColor: isWhite ? '#ffffff' : safe }}
    >
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(normalizeHex(e.target.value, fallback))}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={`${label} color`}
      />
    </label>
  );
}

function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = FONT_PAIRS.find((f) => f.value === value) ?? FONT_PAIRS[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', CONTROL_H)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-full w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 text-left shadow-[0_1px_2px_rgba(15,15,25,0.04)] transition',
          open ? 'border-brand-300 ring-2 ring-brand-500/15' : 'border-line hover:border-line-strong',
        )}
      >
        <span className="truncate text-[15px] font-medium text-ink" style={{ fontFamily: current.stack }}>
          {current.label.replace(/\s*\(.*\)$/, '')}
        </span>
        <IconChevronDown
          size={18}
          className={cn('shrink-0 text-neutral-400 transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_40px_-12px_rgba(15,15,25,0.18)]">
          {FONT_PAIRS.map((f) => {
            const active = f.value === value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  onChange(f.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2.5 text-left transition',
                  active ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-surface-muted',
                )}
              >
                <span className="text-sm font-medium" style={{ fontFamily: f.stack }}>
                  {f.label.replace(/\s*\(.*\)$/, '')}
                </span>
                <span className="text-xs text-neutral-400">
                  {f.label.match(/\(([^)]+)\)/)?.[1]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Stan-style colors + font bar below the theme carousel. */
export function DesignControlsPanel({
  accent,
  background,
  fontPair,
  onAccentChange,
  onBackgroundChange,
  onFontChange,
}: {
  accent: string;
  background: string;
  fontPair: string;
  onAccentChange: (v: string) => void;
  onBackgroundChange: (v: string) => void;
  onFontChange: (v: string) => void;
}) {
  return (
    <div className="mt-6 rounded-2xl bg-[#f3f4f8] px-5 py-4 sm:px-6">
      <div className="grid items-end gap-6 sm:grid-cols-2">
        {/* Colors */}
        <div>
          <h3 className="mb-2.5 text-sm font-bold tracking-tight text-ink">Colors</h3>
          <div className={cn('flex items-center gap-2.5', CONTROL_H)}>
            <ColorSwatch
              label="Button"
              value={accent}
              fallback="#5865f2"
              onChange={onAccentChange}
            />
            <ColorSwatch
              label="Background"
              value={background}
              fallback="#ffffff"
              onChange={onBackgroundChange}
            />
          </div>
        </div>

        {/* Font */}
        <div>
          <h3 className="mb-2.5 text-sm font-bold tracking-tight text-ink">Font</h3>
          <FontPicker value={fontPair} onChange={onFontChange} />
        </div>
      </div>
    </div>
  );
}
