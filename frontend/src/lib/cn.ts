/** Tiny classNames joiner — filters out falsey values. No external deps. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
