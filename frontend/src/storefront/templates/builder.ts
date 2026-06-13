import { BLOCK_DEFS } from '../schema/blocks';
import type { Block, BlockType } from '../schema/types';
import { makeId } from '../runtime/hydrate';

/** Build a configured block: defaults merged with template-specific overrides. */
export function templateBlock(type: BlockType, cfg: Record<string, any> = {}): Block {
  return { id: makeId(type), type, visible: true, config: { ...BLOCK_DEFS[type].default, ...cfg } };
}
