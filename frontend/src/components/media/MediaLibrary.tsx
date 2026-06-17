'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import {
  uploadToCloudinary,
  recordMedia,
  type MediaItem,
  type SignKind,
  type Signer,
} from '@/lib/upload';
import { IconX, IconUpload, IconTrash, IconImage, IconCheck, IconCopy, IconPlay } from '@/components/icons';
import { cn } from '@/lib/cn';

type Accept = 'image' | 'file' | 'all';
type SortKey = 'newest' | 'oldest' | 'name' | 'largest';

interface OpenOptions {
  /** Which assets to show + allow uploading. Defaults to 'all'. */
  accept?: Accept;
  /** Upload purpose — binds the Cloudinary folder + resource type. */
  kind: SignKind;
  title?: string;
  /** Called with the chosen asset; the library closes afterwards. */
  onSelect: (media: MediaItem) => void;
}

interface MediaLibraryContextValue {
  open: (options: OpenOptions) => void;
}

const MediaLibraryContext = createContext<MediaLibraryContextValue | null>(null);

export function useMediaLibrary(): MediaLibraryContextValue {
  const ctx = useContext(MediaLibraryContext);
  if (!ctx) throw new Error('useMediaLibrary must be used within MediaLibraryProvider');
  return ctx;
}

/** Mount once near the app root. Holds the modal and exposes `open()` via context. */
export function MediaLibraryProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<OpenOptions | null>(null);
  const open = useCallback((o: OpenOptions) => setOptions(o), []);

  return (
    <MediaLibraryContext.Provider value={{ open }}>
      {children}
      {options && <MediaLibraryModal options={options} onClose={() => setOptions(null)} />}
    </MediaLibraryContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 40;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv|ogv)(\?.*)?$/i;

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A renderable thumbnail URL: images as-is, videos as a Cloudinary still frame. */
function thumbUrl(m: MediaItem): string | null {
  if (m.resourceType === 'image') return m.url;
  if (m.resourceType === 'video') return m.url.replace(VIDEO_EXT, '.jpg');
  return null;
}

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  name: 'Name A–Z',
  largest: 'Largest',
};

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

function MediaLibraryModal({ options, onClose }: { options: OpenOptions; onClose: () => void }) {
  const { authedRequest } = useAuth();
  const accept = options.accept ?? 'all';
  const allowImages = accept !== 'file';

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [usage, setUsage] = useState<{ totalBytes: number; totalCount: number }>({ totalBytes: 0, totalCount: 0 });

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [typeTab, setTypeTab] = useState<Accept>(accept);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [detail, setDetail] = useState<MediaItem | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sign = useCallback<Signer>(
    (kind: SignKind) =>
      authedRequest('/api/cloudinary/sign-upload', { method: 'POST', body: { kind } }),
    [authedRequest],
  );

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ type: typeTab, sort, page: String(p), limit: String(PAGE_SIZE) });
        if (search.trim()) qs.set('search', search.trim());
        const res = await authedRequest<{
          items: MediaItem[];
          hasMore: boolean;
          library?: { totalBytes: number; totalCount: number };
        }>(`/api/media?${qs}`);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        if (res.library) setUsage(res.library);
        setPage(p);
      } catch {
        setError('Could not load your media library.');
      } finally {
        setLoading(false);
      }
    },
    [authedRequest, typeTab, sort, search],
  );

  // (Re)load on filter/sort/search change (debounced for search).
  useEffect(() => {
    const t = setTimeout(() => void load(1, true), 250);
    return () => clearTimeout(t);
  }, [load]);

  // Autofocus search shortly after open.
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // ESC (closes detail first, then the library) + lock background scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDetail((d) => {
        if (d) return null;
        onClose();
        return null;
      });
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Paste-to-upload (image fields only).
  useEffect(() => {
    if (!allowImages) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter((f): f is File => Boolean(f));
      if (files.length) {
        e.preventDefault();
        void uploadFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowImages, options.kind]);

  function validate(files: File[]): { accepted: File[]; errors: string[] } {
    const accepted: File[] = [];
    const errors: string[] = [];
    for (const f of files) {
      const isImage = f.type.startsWith('image/');
      if (accept === 'image' && !isImage) {
        errors.push(`"${f.name}" isn't an image.`);
        continue;
      }
      const max = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
      if (f.size > max) {
        errors.push(`"${f.name}" is too large (max ${formatBytes(max)}).`);
        continue;
      }
      accepted.push(f);
    }
    return { accepted, errors };
  }

  async function uploadFiles(fileList: File[] | FileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const { accepted, errors } = validate(files);
    setError(errors.join(' '));
    if (!accepted.length) return;

    setUploadingCount(accepted.length);
    const uploaded: MediaItem[] = [];
    try {
      for (const file of accepted) {
        const res = await uploadToCloudinary(file, options.kind, sign);
        const media = await recordMedia(authedRequest, res, options.kind);
        if (media) uploaded.push(media);
        setUploadingCount((n) => Math.max(0, n - 1));
      }
      // A single upload from a picker is almost always "use this now".
      if (uploaded.length === 1 && !selectMode) {
        options.onSelect(uploaded[0]);
        onClose();
        return;
      }
      await load(1, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingCount(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function choose(media: MediaItem) {
    if (selectMode) {
      toggleSelect(media.id);
      return;
    }
    options.onSelect(media);
    onClose();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteOne(media: MediaItem) {
    await authedRequest(`/api/media/${media.id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((x) => x.id !== media.id));
    setUsage((u) => ({ totalBytes: Math.max(0, u.totalBytes - media.bytes), totalCount: Math.max(0, u.totalCount - 1) }));
  }

  async function confirmDeleteOne(media: MediaItem) {
    if (!window.confirm(`Delete "${media.filename || 'this asset'}"? It will be removed from your library and storage.`)) {
      return;
    }
    try {
      await deleteOne(media);
      setDetail((d) => (d?.id === media.id ? null : d));
    } catch {
      setError('Could not delete that asset.');
    }
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} selected asset(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    const targets = items.filter((m) => selected.has(m.id));
    try {
      for (const m of targets) {
        await deleteOne(m).catch(() => undefined);
      }
      setSelected(new Set());
      setSelectMode(false);
    } finally {
      setBulkBusy(false);
    }
  }

  async function copyUrl(media: MediaItem) {
    try {
      await navigator.clipboard.writeText(media.url);
      setCopiedId(media.id);
      setTimeout(() => setCopiedId((c) => (c === media.id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  async function rename(media: MediaItem, filename: string) {
    const name = filename.trim();
    if (!name || name === media.filename) return;
    try {
      const { media: updated } = await authedRequest<{ media: MediaItem }>(`/api/media/${media.id}`, {
        method: 'PATCH',
        body: { filename: name },
      });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setDetail((d) => (d?.id === updated.id ? updated : d));
    } catch {
      setError('Could not rename that asset.');
    }
  }

  const acceptAttr = accept === 'image' ? 'image/*' : undefined;
  const title = options.title ?? (accept === 'file' ? 'Select a file' : 'Select media');
  const showTabs = accept === 'all';
  const empty = !loading && items.length === 0 && uploadingCount === 0;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex w-full animate-scale-in flex-col bg-white shadow-lift',
          'max-h-[92dvh] rounded-t-3xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:rounded-3xl',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-line/70 px-5 pb-3 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-center justify-between gap-3 pr-9">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectMode((s) => !s);
                  setSelected(new Set());
                }}
                className={cn(
                  'rounded-full border px-3 py-2 text-sm font-semibold transition',
                  selectMode ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink hover:bg-surface-muted',
                )}
              >
                {selectMode ? 'Done' : 'Select'}
              </button>
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90',
                  uploadingCount > 0 && 'pointer-events-none opacity-60',
                )}
              >
                <IconUpload size={15} />
                {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : 'Upload'}
                <input ref={fileRef} type="file" accept={acceptAttr} multiple onChange={(e) => e.target.files && void uploadFiles(e.target.files)} className="hidden" />
              </label>
            </div>
          </div>

          {/* Controls row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name…"
              className="min-w-[160px] flex-1 rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/15"
            />
            {showTabs && (
              <div className="flex rounded-xl border border-line bg-surface-muted p-0.5">
                {(['all', 'image', 'file'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeTab(t)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition',
                      typeTab === t ? 'bg-white text-ink shadow-xs' : 'text-neutral-500 hover:text-ink',
                    )}
                  >
                    {t === 'file' ? 'Files' : t === 'image' ? 'Images' : 'All'}
                  </button>
                ))}
              </div>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-brand-500 focus:bg-white"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 z-10 rounded-full p-1.5 text-neutral-400 transition hover:bg-surface-muted hover:text-ink"
          aria-label="Close"
        >
          <IconX size={18} />
        </button>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
          )}

          {empty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-neutral-400">
                <IconImage size={26} />
              </div>
              <p className="mt-4 text-sm font-semibold text-ink">{search ? 'No matches' : 'Your library is empty'}</p>
              <p className="mt-1 max-w-xs text-sm text-neutral-500">
                {search ? 'Try a different search term.' : 'Drag & drop, paste, or upload a file — it will appear here, ready to reuse anywhere.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {Array.from({ length: uploadingCount }).map((_, i) => (
                  <div key={`up-${i}`} className="relative aspect-square animate-pulse rounded-xl bg-surface-muted">
                    <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-neutral-400">Uploading…</span>
                  </div>
                ))}
                {loading && items.length === 0
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <div key={`sk-${i}`} className="aspect-square animate-pulse rounded-xl bg-surface-muted" />
                    ))
                  : items.map((m) => (
                      <MediaTile
                        key={m.id}
                        media={m}
                        selectMode={selectMode}
                        selected={selected.has(m.id)}
                        copied={copiedId === m.id}
                        onChoose={() => choose(m)}
                        onCopy={() => void copyUrl(m)}
                        onInfo={() => setDetail(m)}
                        onDelete={() => void confirmDeleteOne(m)}
                      />
                    ))}
              </div>

              {hasMore && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => void load(page + 1, false)}
                    disabled={loading}
                    className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-50"
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Drag overlay */}
          {dragOver && (
            <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/80 backdrop-blur-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <IconUpload size={18} /> Drop to upload
              </p>
            </div>
          )}
        </div>

        {/* Footer: usage + bulk actions */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7">
          <p className="text-xs text-neutral-500">
            {usage.totalCount} item{usage.totalCount === 1 ? '' : 's'} · {formatBytes(usage.totalBytes)} used
          </p>
          {selectMode && selected.size > 0 && (
            <button
              type="button"
              onClick={() => void bulkDelete()}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              <IconTrash size={14} /> {bulkBusy ? 'Deleting…' : `Delete ${selected.size}`}
            </button>
          )}
        </div>
      </div>

      {detail && (
        <MediaDetail
          media={detail}
          onClose={() => setDetail(null)}
          onUse={() => {
            options.onSelect(detail);
            onClose();
          }}
          onCopy={() => void copyUrl(detail)}
          copied={copiedId === detail.id}
          onRename={(name) => void rename(detail, name)}
          onDelete={() => void confirmDeleteOne(detail)}
        />
      )}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Tile                                                               */
/* ------------------------------------------------------------------ */

function MediaTile({
  media,
  selectMode,
  selected,
  copied,
  onChoose,
  onCopy,
  onInfo,
  onDelete,
}: {
  media: MediaItem;
  selectMode: boolean;
  selected: boolean;
  copied: boolean;
  onChoose: () => void;
  onCopy: () => void;
  onInfo: () => void;
  onDelete: () => void;
}) {
  const thumb = thumbUrl(media);
  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-xl border bg-surface-muted',
        selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-line',
      )}
    >
      <button type="button" onClick={onChoose} className="flex h-full w-full flex-col items-center justify-center" title={media.filename}>
        {thumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt={media.filename} className="h-full w-full object-cover" />
            {media.resourceType === 'video' && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/70 p-1 text-white">
                <IconPlay size={11} />
              </span>
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 shadow-sm">
              {media.format || 'file'}
            </span>
            <span className="line-clamp-2 break-all text-[11px] font-medium text-neutral-600">{media.filename || 'Untitled'}</span>
          </div>
        )}
      </button>

      {/* Select checkbox */}
      {selectMode && (
        <span
          className={cn(
            'pointer-events-none absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-2',
            selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-white bg-ink/30 text-transparent',
          )}
        >
          <IconCheck size={11} />
        </span>
      )}

      {/* Hover actions */}
      {!selectMode && (
        <>
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="rounded-full bg-white/90 p-1.5 text-neutral-600 shadow-sm transition hover:bg-white hover:text-ink"
              aria-label="Copy URL"
            >
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-full bg-white/90 p-1.5 text-neutral-500 shadow-sm transition hover:bg-white hover:text-red-600"
              aria-label="Delete"
            >
              <IconTrash size={13} />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
            <span className="truncate text-[10px] font-medium text-white/90">{formatBytes(media.bytes)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInfo();
              }}
              className="pointer-events-auto rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-ink transition hover:bg-white"
            >
              Details
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail / rename panel                                              */
/* ------------------------------------------------------------------ */

function MediaDetail({
  media,
  onClose,
  onUse,
  onCopy,
  copied,
  onRename,
  onDelete,
}: {
  media: MediaItem;
  onClose: () => void;
  onUse: () => void;
  onCopy: () => void;
  copied: boolean;
  onRename: (filename: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(media.filename);
  useEffect(() => setName(media.filename), [media.filename]);
  const thumb = thumbUrl(media);
  const dims = media.width && media.height ? `${media.width}×${media.height}` : null;
  const meta = useMemo(
    () => [media.format?.toUpperCase(), dims, formatBytes(media.bytes), formatDate(media.createdAt)].filter(Boolean).join(' · '),
    [media, dims],
  );

  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative flex w-full animate-scale-in flex-col gap-4 rounded-t-3xl bg-white p-5 shadow-lift sm:max-w-sm sm:rounded-3xl sm:p-6">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 transition hover:bg-surface-muted hover:text-ink" aria-label="Close">
          <IconX size={18} />
        </button>

        <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-surface-muted">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={media.filename} className="h-full w-full object-contain" />
          ) : (
            <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500 shadow-sm">
              {media.format || 'file'}
            </span>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-500">File name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onRename(name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
          <p className="mt-2 text-xs text-neutral-500">{meta}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onUse} className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
            Use this
          </button>
          <button onClick={onCopy} className="rounded-full border border-line p-2.5 text-neutral-600 transition hover:bg-surface-muted hover:text-ink" aria-label="Copy URL" title="Copy URL">
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </button>
          <button onClick={onDelete} className="rounded-full border border-line p-2.5 text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label="Delete" title="Delete">
            <IconTrash size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
