'use client';

/**
 * Shared media-library building blocks used by BOTH the full-page manager
 * (`dashboard/media`) and the in-context picker popup (`MediaLibrary`). Keeping
 * these here means the picker is the *same advanced* library, not a stripped-down
 * fork — fix a thumbnail/viewer once and both surfaces get it.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import type { MediaItem, SignKind } from '@/lib/upload';
import {
  IconImage, IconTrash, IconCopy, IconPencil, IconCheck, IconX, IconPlus,
  IconExternal, IconDownload, IconChevronLeft, IconChevronRight, IconPlay,
  IconFolder,
} from '@/components/icons';

/* ------------------------------------------------------------------ */
/* Types + constants                                                   */
/* ------------------------------------------------------------------ */

export type TypeFilter = 'all' | 'image' | 'file';
export type Sort = 'newest' | 'oldest' | 'name' | 'largest';
export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'other';

export interface Folder {
  id: string;
  name: string;
  count: number;
}

export const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'file', label: 'Files & video' },
];

export const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'largest', label: 'Largest' },
];

const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '∞';
  if (n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const val = n / Math.pow(1024, i);
  return `${val >= 100 || i === 0 ? Math.round(val) : val.toFixed(1)} ${units[i]}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Pick a Cloudinary signing kind for an arbitrary dropped/picked file. */
export function signKindFor(file: File): SignKind {
  if (file.type.startsWith('image/')) return 'product_cover';
  if (file.type.startsWith('video/')) return 'course_video';
  return 'product_file';
}

/** How a media item should be previewed in the viewer. */
export function previewKind(item: MediaItem): PreviewKind {
  const fmt = (item.format || '').toLowerCase();
  const url = (item.url || '').toLowerCase();
  if (item.resourceType === 'image') return 'image';
  if (AUDIO_FORMATS.includes(fmt) || AUDIO_FORMATS.some((f) => url.endsWith('.' + f))) return 'audio';
  if (item.resourceType === 'video') return 'video';
  if (fmt === 'pdf' || url.endsWith('.pdf')) return 'pdf';
  return 'other';
}

/**
 * Build a square preview thumbnail from a Cloudinary URL: resize images for fast
 * grids, and extract a poster frame for videos. Returns null when no inline
 * thumbnail is possible (raw docs) so the tile shows a typed icon instead.
 */
export function thumbUrl(item: MediaItem): string | null {
  const url = item.url || '';
  if (!url.includes('/upload/')) return item.resourceType === 'image' ? url : null;
  const kind = previewKind(item);
  if (kind === 'image') {
    return url.replace('/upload/', '/upload/c_fill,w_500,h_500,q_auto,f_auto/');
  }
  if (kind === 'video') {
    return url.replace('/upload/', '/upload/c_fill,w_500,h_500,q_auto,so_0/').replace(VIDEO_EXT, '.jpg');
  }
  if (kind === 'pdf') {
    // Works when the PDF was delivered through the image pipeline; onError falls back.
    return url.replace('/upload/', '/upload/c_fill,w_500,h_500,q_auto,pg_1/').replace(/\.pdf$/i, '.jpg');
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Thumbnail                                                           */
/* ------------------------------------------------------------------ */

/** Square preview used by grid tiles, list rows and the picker. */
export function Thumb({ item, rounded = '' }: { item: MediaItem; rounded?: string }) {
  const [err, setErr] = useState(false);
  const kind = previewKind(item);
  const thumb = !err ? thumbUrl(item) : null;
  if (thumb) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-surface-subtle', rounded)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={item.filename || 'media'} className="h-full w-full object-cover" loading="lazy" onError={() => setErr(true)} />
        {(kind === 'video' || kind === 'audio') && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white"><IconPlay size={16} /></span>
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn('relative grid h-full w-full place-items-center bg-surface-subtle text-neutral-400', rounded)}>
      <div className="text-center">
        {kind === 'audio' ? <IconPlay size={28} /> : <IconImage size={28} />}
        <div className="mt-1 text-2xs font-semibold uppercase tracking-wide">{item.format || item.resourceType}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full-screen viewer / lightbox                                       */
/* ------------------------------------------------------------------ */

export function MediaViewer({
  item, index, total, onClose, onPrev, onNext, onCopy, copied, onRename, onDelete, onUse, useLabel = 'Use this file', getPreviewUrl, previewOnly = false,
}: {
  item: MediaItem;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCopy: () => void;
  copied: boolean;
  onRename: () => void;
  onDelete: () => void;
  /** When provided (picker mode), shows a prominent action to select this asset. */
  onUse?: () => void;
  useLabel?: string;
  /**
   * Resolves a working delivery URL for an asset. Needed for raw documents
   * (PDF/ZIP) because Cloudinary blocks plain public delivery of those — the
   * bare URL 401s, so we fetch a signed one. Images/videos use `item.url`.
   */
  getPreviewUrl?: (item: MediaItem) => Promise<string>;
  /** Hide the Open/Download actions — a clean, view-only preview. */
  previewOnly?: boolean;
}) {
  // Keyboard: Esc closes, ← / → navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  // Lock background scroll so the preview is a clean, full-screen overlay.
  // `mounted` gates the portal so it only renders client-side (avoids SSR throw).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const kind = previewKind(item);

  // For documents, resolve a signed URL (bare PDF/ZIP URLs are blocked by
  // Cloudinary). Images/audio/video stream fine from the stored URL.
  const needsResolve = kind === 'pdf' || kind === 'other';
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);
  useEffect(() => {
    if (!needsResolve) {
      setResolved(item.url);
      setResolveError(false);
      return;
    }
    let active = true;
    setResolved(null);
    setResolveError(false);
    const resolver = getPreviewUrl ? getPreviewUrl(item) : Promise.resolve(item.url);
    resolver
      .then((u) => { if (active) setResolved(u || item.url); })
      .catch(() => { if (active) { setResolved(item.url); setResolveError(true); } });
    return () => { active = false; };
  }, [item, needsResolve, getPreviewUrl]);

  // URL the action bar (Open / Download) should point at — signed when resolved.
  const fileUrl = resolved ?? item.url;
  const name = item.filename || item.publicId.split('/').pop() || 'media';
  const meta = [
    item.resourceType,
    item.format?.toUpperCase(),
    item.width && item.height ? `${item.width}×${item.height}` : null,
    formatBytes(item.bytes),
    formatDate(item.createdAt),
  ].filter(Boolean).join('  ·  ');

  const action = 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10';

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-black/95 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="rounded-full p-2 text-white/80 transition hover:bg-white/10" title="Back"><IconChevronLeft size={20} /></button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>{name}</span>
        <span className="shrink-0 text-xs text-white/50">{index + 1} / {total}</span>
        {onUse && (
          <button onClick={onUse} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700">
            <IconCheck size={16} /> {useLabel}
          </button>
        )}
        <button onClick={onClose} className="rounded-full p-2 text-white/80 transition hover:bg-white/10" title="Close (Esc)"><IconX size={20} /></button>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button onClick={onPrev} className="absolute left-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" title="Previous (←)"><IconChevronLeft size={22} /></button>
        )}

        <div className="flex max-h-full max-w-5xl items-center justify-center">
          {kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={name} className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl" />
          )}
          {kind === 'video' && (
            <video src={item.url} controls autoPlay className="max-h-[78vh] max-w-full rounded-lg shadow-2xl" />
          )}
          {kind === 'audio' && (
            <div className="w-[min(90vw,520px)] rounded-2xl bg-white p-8 text-center shadow-2xl">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-brand-50 text-brand-600"><IconPlay size={36} /></div>
              <div className="mb-4 truncate text-sm font-semibold text-[#1a1c3a]">{name}</div>
              <audio src={item.url} controls autoPlay className="w-full" />
            </div>
          )}
          {kind === 'pdf' && (
            resolved === null && !resolveError ? (
              <div className="grid h-[78vh] w-[min(90vw,900px)] place-items-center rounded-lg bg-white shadow-2xl">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
              </div>
            ) : (
              // #toolbar=0&navpanes=0 hides the browser PDF viewer's save/print/download bar.
              <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} title={name} className="h-[78vh] w-[min(90vw,900px)] rounded-lg bg-white shadow-2xl" />
            )
          )}
          {kind === 'other' && (
            <div className="w-[min(90vw,420px)] rounded-2xl bg-white p-10 text-center shadow-2xl">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-surface-subtle text-neutral-400"><IconImage size={40} /></div>
              <div className="truncate text-base font-bold text-[#1a1c3a]">{name}</div>
              <div className="mt-1 text-sm text-neutral-500">{item.format?.toUpperCase() || item.resourceType} · {formatBytes(item.bytes)}</div>
              <p className="mt-3 text-xs text-neutral-400">No inline preview for this file type.</p>
              <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"><IconDownload size={16} /> Download</a>
            </div>
          )}
        </div>

        {total > 1 && (
          <button onClick={onNext} className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" title="Next (→)"><IconChevronRight size={22} /></button>
        )}
      </div>

      {/* Bottom bar: meta + actions */}
      <div className="flex flex-col items-center gap-2 px-3 py-3 sm:flex-row sm:flex-wrap sm:justify-between sm:px-5 sm:py-4" onClick={(e) => e.stopPropagation()}>
        <span className="order-2 text-center text-2xs text-white/50 sm:order-1 sm:text-xs">{meta}</span>
        <div className="order-1 flex items-center justify-center gap-0.5 sm:order-2 sm:gap-1">
          <button onClick={onCopy} className={action}>{copied ? <IconCheck size={16} className="text-success-400" /> : <IconCopy size={16} />} <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy URL'}</span></button>
          {!previewOnly && <a href={fileUrl} target="_blank" rel="noreferrer" className={action}><IconExternal size={16} /> <span className="hidden sm:inline">Open</span></a>}
          {!previewOnly && <a href={fileUrl} download={name} className={action}><IconDownload size={16} /> <span className="hidden sm:inline">Download</span></a>}
          <button onClick={onRename} className={action}><IconPencil size={16} /> <span className="hidden sm:inline">Rename</span></button>
          <button onClick={onDelete} className={cn(action, 'text-danger-300 hover:bg-danger-500/15 hover:text-danger-200')}><IconTrash size={16} /> <span className="hidden sm:inline">Delete</span></button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Folder chip bar                                                     */
/* ------------------------------------------------------------------ */

/**
 * Folder filter chips. `activeFolder`: null = All, '' = Uncategorized (root),
 * a name = that folder. Folder management actions are optional so the picker can
 * keep them while a read-only context could omit them.
 */
export function FolderBar({
  folders, activeFolder, totalCount, rootCount, onSelect, onNew, onRename, onDelete,
}: {
  folders: Folder[];
  activeFolder: string | null;
  totalCount: number;
  rootCount: number;
  onSelect: (key: string | null) => void;
  onNew?: () => void;
  onRename?: (f: Folder) => void;
  onDelete?: (f: Folder) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => onSelect(null)} className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition', activeFolder === null ? 'bg-brand-600 text-white' : 'bg-surface-subtle text-neutral-600 hover:bg-brand-50 hover:text-brand-600')}>
        All <span className={cn('text-xs', activeFolder === null ? 'text-white/70' : 'text-neutral-400')}>{totalCount}</span>
      </button>
      <button onClick={() => onSelect('')} className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition', activeFolder === '' ? 'bg-brand-600 text-white' : 'bg-surface-subtle text-neutral-600 hover:bg-brand-50 hover:text-brand-600')}>
        <IconFolder size={14} /> Uncategorized <span className={cn('text-xs', activeFolder === '' ? 'text-white/70' : 'text-neutral-400')}>{rootCount}</span>
      </button>
      {folders.map((f) => (
        <span key={f.id} className={cn('group inline-flex items-center gap-1.5 rounded-full pl-3.5 pr-2 py-1.5 text-sm font-semibold transition', activeFolder === f.name ? 'bg-brand-600 text-white' : 'bg-surface-subtle text-neutral-600 hover:bg-brand-50 hover:text-brand-600')}>
          <button onClick={() => onSelect(f.name)} className="inline-flex items-center gap-1.5">
            <IconFolder size={14} /> {f.name} <span className={cn('text-xs', activeFolder === f.name ? 'text-white/70' : 'text-neutral-400')}>{f.count}</span>
          </button>
          {(onRename || onDelete) && (
            <span className="flex items-center gap-0.5 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
              {onRename && <button onClick={() => onRename(f)} title="Rename folder" className={cn('rounded-full p-1', activeFolder === f.name ? 'hover:bg-white/20' : 'hover:bg-white')}><IconPencil size={12} /></button>}
              {onDelete && <button onClick={() => onDelete(f)} title="Delete folder" className={cn('rounded-full p-1', activeFolder === f.name ? 'hover:bg-white/20' : 'hover:bg-white hover:text-danger-600')}><IconX size={12} /></button>}
            </span>
          )}
        </span>
      ))}
      {onNew && (
        <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-sm font-semibold text-neutral-500 transition hover:border-brand-400 hover:text-brand-600">
          <IconPlus size={14} /> New folder
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Move-to-folder modal                                                */
/* ------------------------------------------------------------------ */

export function MoveModal({ open, count, folders, current, onClose, onMove }: {
  open: boolean;
  count: number;
  folders: Folder[];
  current: string | null;
  onClose: () => void;
  onMove: (folder: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Move {count} file{count === 1 ? '' : 's'} to…</h2>
      <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
        <button onClick={() => onMove('')} disabled={current === ''} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-surface-subtle disabled:opacity-40">
          <IconFolder size={16} className="text-neutral-400" /> Uncategorized
        </button>
        {folders.map((f) => (
          <button key={f.id} onClick={() => onMove(f.name)} disabled={current === f.name} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-surface-subtle disabled:opacity-40">
            <IconFolder size={16} className="text-brand-500" /> {f.name}
            <span className="ml-auto text-xs text-neutral-400">{f.count}</span>
          </button>
        ))}
        {folders.length === 0 && <p className="px-3 py-4 text-center text-sm text-neutral-400">No folders yet — create one first.</p>}
      </div>
    </Modal>
  );
}
