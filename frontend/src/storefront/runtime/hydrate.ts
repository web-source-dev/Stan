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

/** Migrate older/loose persisted blocks into builder Blocks with full config. */
export function hydrateBlocks(
  raw: { id: string; type: string; config?: Record<string, any>; visible?: boolean }[],
): Block[] {
  const blocks: Block[] = [];
  for (const b of raw) {
    const def = BLOCK_DEFS[b.type as BlockType];
    if (!def) continue;
    blocks.push({
      id: b.id || makeId(b.type),
      type: b.type as BlockType,
      visible: b.visible !== false,
      config: { ...def.default, ...(b.config ?? {}) },
    });
  }
  if (!blocks.some((bl) => bl.type === 'header')) blocks.unshift(createBlock('header'));
  return blocks;
}
