/** Shared Tailwind class maps for the storefront renderer. */

export const RADIUS_CLASS: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  '2xl': 'rounded-3xl',
  full: 'rounded-full',
};

export const SHADOW_CLASS: Record<string, string> = {
  none: '',
  soft: 'shadow-soft',
  lift: 'shadow-lift',
};

export const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left items-start',
  center: 'text-center items-center',
  right: 'text-right items-end',
};

export const TEXT_SIZE: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
};

export const HEADING_SIZE: Record<string, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};
