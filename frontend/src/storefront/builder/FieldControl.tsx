'use client';

import { Field, Textarea, Select, Button } from '@/components/ui';
import { IconPlus, IconTrash } from '@/components/icons';
import type { FieldSpec } from '../schema/types';
import { cn } from '@/lib/cn';

/** Generic renderer for a single block-config field, driven by its FieldSpec. */
export function FieldControl({ spec, value, onChange }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  if (spec.type === 'text') return <Field label={spec.label} placeholder={spec.placeholder} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  if (spec.type === 'textarea') return <Textarea label={spec.label} rows={3} placeholder={spec.placeholder} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  if (spec.type === 'color') return <ColorField label={spec.label} value={(value as string) ?? ''} onChange={onChange} />;
  if (spec.type === 'select') return (
    <Select label={spec.label} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
      {spec.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
  if (spec.type === 'toggle') return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm font-medium text-neutral-800">{spec.label}</span>
      <button type="button" onClick={() => onChange(!value)} className={cn('relative h-6 w-11 rounded-full transition', value ? 'bg-brand-600' : 'bg-neutral-300')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', value ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
  if (spec.type === 'range') return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-neutral-800">{spec.label}<span className="text-xs text-neutral-400">{(value as number) ?? spec.min}</span></span>
      <input type="range" min={spec.min} max={spec.max} step={spec.step ?? 1} value={(value as number) ?? spec.min} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-600" />
    </label>
  );
  if (spec.type === 'number') return <Field label={spec.label} type="number" min={spec.min} max={spec.max} value={String(value ?? '')} onChange={(e) => onChange(Number(e.target.value))} />;
  if (spec.type === 'repeater') {
    const rows: Record<string, string>[] = Array.isArray(value) ? (value as Record<string, string>[]) : [];
    const update = (i: number, key: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
    const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));
    const addRow = () => onChange([...rows, Object.fromEntries(spec.columns.map((c) => [c.key, ''])) as Record<string, string>]);
    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-neutral-800">{spec.label}</span>
        <div className="space-y-2.5">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-line-strong bg-surface-muted/40 p-2.5">
              <div className="space-y-1.5">
                {spec.columns.map((c) =>
                  c.multiline ? (
                    <textarea key={c.key} rows={2} value={row[c.key] ?? ''} placeholder={c.placeholder}
                      onChange={(e) => update(i, c.key, e.target.value)}
                      className="w-full resize-none rounded-lg border border-line-strong bg-white px-3 py-1.5 text-sm" />
                  ) : (
                    <input key={c.key} value={row[c.key] ?? ''} placeholder={c.placeholder}
                      onChange={(e) => update(i, c.key, e.target.value)}
                      className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-sm" />
                  ),
                )}
              </div>
              <div className="mt-1 flex justify-end">
                <button onClick={() => removeRow(i)} className="rounded-lg p-1 text-neutral-400 hover:text-danger-600"><IconTrash size={13} /></button>
              </div>
            </div>
          ))}
          {rows.length < (spec.max ?? 12) && (
            <Button variant="ghost" size="sm" onClick={addRow}><IconPlus size={14} /> {spec.addLabel}</Button>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-800">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-white px-2 py-1.5">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="default" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </div>
    </label>
  );
}
