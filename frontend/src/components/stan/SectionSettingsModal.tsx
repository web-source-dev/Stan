'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui';
import { BLOCK_DEFS, type Block } from '@/storefront';
import { FieldControl } from '@/storefront/builder/FieldControl';

/**
 * Edit a single section's content/appearance — renders the block type's fields
 * (heading text, button label/URL, CTA style, etc.) and saves on confirm.
 */
export function SectionSettingsModal({
  block,
  onClose,
  onSave,
}: {
  block: Block | null;
  onClose: () => void;
  onSave: (id: string, config: Record<string, unknown>) => void;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (block) setConfig({ ...block.config });
  }, [block]);

  if (!block) return null;
  const def = BLOCK_DEFS[block.type];

  return (
    <Modal
      open={!!block}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <span>{def.emoji}</span> Edit {def.label}
        </span>
      }
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(block.id, config)}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {def.fields.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">This section has no editable content.</p>
        ) : (
          def.fields.map((f) => (
            <FieldControl
              key={f.key}
              spec={f}
              value={config[f.key]}
              onChange={(v) => setConfig((c) => ({ ...c, [f.key]: v }))}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
