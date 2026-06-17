/** Theme resolution helpers shared by the renderer and builder. */

import type { CSSProperties } from 'react';

export const FONT_PAIRS: { value: string; label: string; stack: string }[] = [
  { value: 'default', label: 'Inter (clean)', stack: "'Inter', ui-sans-serif, system-ui, sans-serif" },
  { value: 'poppins', label: 'Poppins (rounded)', stack: "'Poppins', 'Inter', ui-sans-serif, sans-serif" },
  { value: 'serif', label: 'Serif (editorial)', stack: "Georgia, Cambria, 'Times New Roman', serif" },
  { value: 'mono', label: 'Mono (technical)', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

export type ThemeSpacing = 'compact' | 'comfortable' | 'airy';
export type ThemeCardChrome = 'elevated' | 'flat' | 'glass';
export type ThemeMotion = 'none' | 'subtle' | 'expressive';

export interface StoreThemeInput {
  background?: string;
  accent?: string;
  accent2?: string;
  backgroundStyle?: 'flat' | 'solid' | 'gradient' | 'mesh';
  fontPair?: string;
  buttonStyle?: 'solid' | 'outline' | 'soft' | string;
  cardStyle?: 'flat' | 'shadow' | 'border' | string;
  spacing?: ThemeSpacing;
  cardChrome?: ThemeCardChrome;
  motion?: ThemeMotion;
  templateId?: string;
}

export interface ResolvedTheme {
  background: string;
  accent: string;
  accent2: string;
  backgroundStyle: 'solid' | 'gradient' | 'mesh' | 'flat';
  fontPair: string;
  buttonStyle: string;
  spacing: ThemeSpacing;
  cardChrome: ThemeCardChrome;
  motion: ThemeMotion;
  /** Tailwind gap between block sections */
  sectionGap: string;
  /** Tailwind gap inside sections */
  innerGap: string;
  /** Horizontal padding for content column */
  contentPx: string;
  animateBlocks: boolean;
  tapClass: string;
  /** Hover lift on cards (live + preview). */
  cardHoverClass: string;
  /** Hover glow on primary buttons. */
  btnHoverClass: string;
}

const SPACING_MAP: Record<ThemeSpacing, { section: string; inner: string; content: string }> = {
  compact: { section: 'space-y-4', inner: 'space-y-2.5', content: 'px-5' },
  comfortable: { section: 'space-y-5', inner: 'space-y-3.5', content: 'px-5' },
  airy: { section: 'space-y-7', inner: 'space-y-4', content: 'px-6' },
};

export function fontStack(fontPair?: string): string {
  return (FONT_PAIRS.find((f) => f.value === fontPair) ?? FONT_PAIRS[0]).stack;
}

export function isDarkHex(hex?: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}

/** Saturated mid-tone fills (e.g. hot pink cards) need light text even when luminance is high. */
export function prefersLightInkOnBg(hex?: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return false;
  if (isDarkHex(hex)) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return chroma > 55 && lum < 210;
}

function inferCardChrome(input: StoreThemeInput | null | undefined, dark: boolean): ThemeCardChrome {
  const c = input?.cardChrome;
  if (c === 'elevated' || c === 'flat' || c === 'glass') return c;
  if (input?.cardStyle === 'flat') return 'flat';
  if (input?.cardStyle === 'border') return 'flat';
  if (dark && (input?.backgroundStyle === 'mesh' || input?.backgroundStyle === 'gradient')) return 'glass';
  if (input?.cardStyle === 'shadow') return 'elevated';
  return 'elevated';
}

function inferSpacing(input: StoreThemeInput | null | undefined): ThemeSpacing {
  const s = input?.spacing;
  if (s === 'compact' || s === 'comfortable' || s === 'airy') return s;
  if (input?.backgroundStyle === 'mesh') return 'compact';
  if (input?.fontPair === 'serif') return 'airy';
  return 'comfortable';
}

function inferMotion(input: StoreThemeInput | null | undefined): ThemeMotion {
  const m = input?.motion;
  if (m === 'none' || m === 'subtle' || m === 'expressive') return m;
  return 'subtle';
}

/** Merge persisted theme with sensible defaults (backward compatible). */
export function resolveTheme(input: StoreThemeInput | null | undefined): ResolvedTheme {
  const background = input?.background || '#ffffff';
  const accent = input?.accent || '#6355fa';
  const spacing = inferSpacing(input);
  const space = SPACING_MAP[spacing];
  const motion = inferMotion(input);

  return {
    background,
    accent,
    accent2: input?.accent2 || accent,
    backgroundStyle: input?.backgroundStyle || 'solid',
    fontPair: input?.fontPair || 'default',
    buttonStyle: input?.buttonStyle || 'solid',
    spacing,
    cardChrome: inferCardChrome(input, isDarkHex(background)),
    motion,
    sectionGap: space.section,
    innerGap: space.inner,
    contentPx: space.content,
    animateBlocks: motion !== 'none',
    tapClass: motion !== 'none' ? 'transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100' : '',
    cardHoverClass: 'sf-card-interactive',
    btnHoverClass: 'sf-btn-interactive',
  };
}

/** Paint the page background with depth — mesh, gradient, flat, or solid. */
export function pageBackground(bg: string, accent: string, accent2: string, style?: string): string {
  const a2 = accent2 || accent;
  if (style === 'flat') return bg;
  if (style === 'mesh') {
    return [
      `radial-gradient(120% 80% at 12% 8%, ${accent}2e, transparent 55%)`,
      `radial-gradient(120% 80% at 88% 6%, ${a2}29, transparent 50%)`,
      `radial-gradient(140% 90% at 50% 100%, ${accent}1c, transparent 55%)`,
      bg,
    ].join(', ');
  }
  if (style === 'gradient') {
    return `linear-gradient(180deg, ${accent}28 0%, ${a2}12 14%, ${bg} 38%, ${bg} 100%)`;
  }
  /* Solid pages get a whisper of brand tint at the top — Stan-style depth. */
  return `linear-gradient(180deg, ${accent}0f 0%, ${bg} 28%, ${bg} 100%)`;
}

export function templateThumbBackground(
  background: string,
  accent: string,
  accent2: string | undefined,
  backgroundStyle?: string,
): string {
  const a2 = accent2 || accent;
  if (backgroundStyle === 'mesh') {
    return `radial-gradient(80% 60% at 15% 10%, ${accent}55, transparent 60%), radial-gradient(80% 60% at 85% 8%, ${a2}4d, transparent 55%), ${background}`;
  }
  if (backgroundStyle === 'gradient') {
    return `linear-gradient(180deg, ${accent}3a, ${background} 70%)`;
  }
  return background;
}

/** Surface classes/styles for cards based on theme chrome. */
export function cardSurface(
  chrome: ThemeCardChrome,
  dark: boolean,
  overrideBg?: string,
): { className: string; backgroundColor: string; borderColor: string } {
  const borderColor = dark ? 'rgba(255,255,255,0.12)' : '#eaeaf0';
  if (overrideBg) {
    return {
      className: chrome === 'elevated' ? 'shadow-soft border' : chrome === 'glass' ? 'border backdrop-blur-xl' : 'border',
      backgroundColor: overrideBg,
      borderColor,
    };
  }
  if (chrome === 'glass') {
    return {
      className: 'border backdrop-blur-xl',
      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
      borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)',
    };
  }
  if (chrome === 'flat') {
    return {
      className: 'border',
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#ffffff',
      borderColor,
    };
  }
  return {
    className: 'shadow-soft border',
    backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#ffffff',
    borderColor,
  };
}

export function btnStyleCss(style: string, accent: string): CSSProperties {
  if (style === 'inverse') {
    return {
      background: '#ffffff',
      color: '#0b0b12',
      boxShadow: '0 4px 14px -4px rgba(0,0,0,0.18)',
    };
  }
  if (style === 'neon') {
    return {
      background: accent,
      color: '#0b0b12',
      fontWeight: 700,
      boxShadow: `0 4px 20px -4px ${accent}99`,
    };
  }
  if (style === 'outline') {
    return { color: accent, border: `2px solid ${accent}`, background: 'transparent' };
  }
  if (style === 'soft') {
    return { color: accent, background: `${accent}1a`, border: `1px solid ${accent}33` };
  }
  return {
    background: `linear-gradient(180deg, ${accent} 0%, ${accent}dd 100%)`,
    color: '#fff',
    boxShadow: `0 4px 16px -4px ${accent}55`,
  };
}
