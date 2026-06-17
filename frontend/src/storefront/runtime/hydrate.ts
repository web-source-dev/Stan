import { BLOCK_DEFS } from '../schema/blocks';
import type { Block, BlockType } from '../schema/types';

let _counter = 0;

export function makeId(type: string): string {
  _counter += 1;
  return `${type}_${Date.now().toString(36)}${_counter}`;
}

export function createBlock(type: BlockType): Block {
  return { id: makeId(type), type, visible: true, config: { ...BLOCK_DEFS[type].default } };
}

/** Default storefront for a brand-new builder session. */
export function defaultStoreBlocks(): Block[] {
  return [
    createBlock('header'),
    createBlock('product'),
    createBlock('course'),
    createBlock('booking'),
    createBlock('leadMagnet'),
    createBlock('links'),
    createBlock('emailCapture'),
  ];
}

/** Section types that may exist at most once (a second renders identical content). */
const SINGLE_INSTANCE_TYPES: BlockType[] = ['product', 'course', 'booking', 'leadMagnet', 'links', 'emailCapture'];
/** Collection sections always show their full catalog in this editor. */
const COLLECTION_TYPES: BlockType[] = ['product', 'course', 'booking', 'leadMagnet'];

/** Migrate older/loose persisted blocks into builder Blocks with full config. */
export function hydrateBlocks(
  raw: { id: string; type: string; config?: Record<string, any>; visible?: boolean }[],
): Block[] {
  const blocks: Block[] = [];
  const seen = new Set<BlockType>();
  for (const b of raw) {
    const type = b.type as BlockType;
    const def = BLOCK_DEFS[type];
    if (!def) continue;
    // Collapse duplicate single-instance sections to the first occurrence — a
    // design template that generated several `product` blocks would otherwise
    // make the store editor list every product under each duplicate section.
    if (SINGLE_INSTANCE_TYPES.includes(type)) {
      if (seen.has(type)) continue;
      seen.add(type);
    }
    const config = { ...def.default, ...(b.config ?? {}) };
    // Collection sections render their whole catalog here, so strip any slicing
    // (startIndex/maxItems) left behind by a template — otherwise items vanish.
    if (COLLECTION_TYPES.includes(type)) {
      delete config.startIndex;
      delete config.maxItems;
    }
    blocks.push({
      id: b.id || makeId(type),
      type,
      visible: b.visible !== false,
      config,
    });
  }
  if (!blocks.some((bl) => bl.type === 'header')) blocks.unshift(createBlock('header'));
  return blocks;
}
