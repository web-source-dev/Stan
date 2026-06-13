/**
 * Storefront module — block schema, templates, renderer, and builder.
 *
 *   schema/     Block types, settings fields, Tailwind token maps
 *   templates/  Design presets (theme + layout)
 *   runtime/    Hydration, theme helpers
 *   renderer/   StoreCanvas — shared live + preview renderer
 *   builder/    StoreBuilder — dashboard editor
 */

export type { Block, BlockType, BlockDef, FieldSpec } from './schema/types';
export { BLOCK_DEFS, ADDABLE_BLOCKS } from './schema/blocks';
export {
  RADIUS_CLASS,
  SHADOW_CLASS,
  ALIGN_CLASS,
  TEXT_SIZE,
  HEADING_SIZE,
} from './schema/tokens';

export type { StoreTemplate, StoreTemplateTheme } from './templates/types';
export { STORE_TEMPLATES, getTemplate } from './templates/registry';

export { makeId, createBlock, defaultStoreBlocks, hydrateBlocks } from './runtime/hydrate';
export {
  FONT_PAIRS,
  fontStack,
  isDarkHex,
  pageBackground,
  templateThumbBackground,
  resolveTheme,
  cardSurface,
  btnStyleCss,
  type StoreThemeInput,
  type ResolvedTheme,
  type ThemeSpacing,
  type ThemeCardChrome,
  type ThemeMotion,
} from './runtime/theme';

export { StoreCanvas, type SFItem, type SFProfile, type EmailSlotConfig } from './renderer/StoreCanvas';
export { StoreBuilder } from './builder/StoreBuilder';
