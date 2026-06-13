/**
 * Storefront block builder types — shared by schema, templates, renderer, and builder.
 */

export type BlockType =
  | 'header'
  | 'featured'
  | 'product'
  | 'course'
  | 'booking'
  | 'leadMagnet'
  | 'emailCapture'
  | 'links'
  | 'hero'
  | 'testimonial'
  | 'faq'
  | 'gallery'
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  visible?: boolean;
  config: Record<string, any>;
}

export type FieldSpec =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'textarea'; placeholder?: string }
  | { key: string; label: string; type: 'color' }
  | { key: string; label: string; type: 'toggle' }
  | { key: string; label: string; type: 'number'; min?: number; max?: number }
  | { key: string; label: string; type: 'range'; min: number; max: number; step?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | {
      key: string;
      label: string;
      type: 'repeater';
      addLabel: string;
      max?: number;
      columns: { key: string; placeholder: string; multiline?: boolean }[];
    };

export interface BlockDef {
  type: BlockType;
  label: string;
  emoji: string;
  category: 'profile' | 'offers' | 'content';
  singleton?: boolean;
  pinned?: boolean;
  default: Record<string, any>;
  fields: FieldSpec[];
}
