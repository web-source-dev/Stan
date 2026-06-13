/** Reference screenshot paths for the Edit Design theme carousel. */
export const THEME_PREVIEW_SRC: Record<string, string> = {
  studio: '/stan/themes/studio.png',
  midnight: '/stan/themes/midnight.png',
  blush: '/stan/themes/blush.png',
  violet: '/stan/themes/violet.png',
  wellness: '/stan/themes/wellness.png',
  pastel: '/stan/themes/pastel.png',
  noir: '/stan/themes/noir.png',
  editorial: '/stan/themes/editorial.png',
  bloom: '/stan/themes/bloom.png',
  ocean: '/stan/themes/ocean.png',
};

export function themePreviewSrc(templateId: string, override?: string): string {
  return override ?? THEME_PREVIEW_SRC[templateId] ?? `/stan/themes/${templateId}.png`;
}
