'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import {
  uploadToCloudinary,
  type MediaItem,
  type SignKind,
  type Signer,
} from '@/lib/upload';
import {
  IconX, IconUpload, IconTrash, IconImage, IconCheck, IconCopy, IconFolder,
  IconPencil, IconGrid, IconList, IconEye,
} from '@/components/icons';
import { cn } from '@/lib/cn';
import {
  type TypeFilter, type Sort, type Folder,
  SORTS, formatBytes, formatDate,
  Thumb, MediaViewer,
} from '@/components/media/parts';

type Accept = 'image' | 'file' | 'all';

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

/** Small confirm/prompt-style dialog rendered ABOVE the picker (z-[95]). */
function PickerDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full animate-scale-in rounded-t-3xl bg-white p-5 shadow-lift sm:max-w-sm sm:rounded-3xl sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

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
  const [sort, setSort] = useState<Sort>('newest');
  const [typeTab, setTypeTab] = useState<TypeFilter>(accept);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Folders: activeFolder null = All, '' = Uncategorized (root), name = that folder.
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootCount, setRootCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sign = useCallback<Signer>(
    (kind: SignKind) =>
      authedRequest('/api/cloudinary/sign-upload', { method: 'POST', body: { kind } }),
    [authedRequest],
  );

  // The effective server-side type filter: locked to `accept` unless it's 'all'.
  const effectiveType: TypeFilter = accept === 'all' ? typeTab : accept;

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ type: effectiveType, sort, page: String(p), limit: String(PAGE_SIZE) });
        if (search.trim()) qs.set('search', search.trim());
        if (activeFolder !== null) qs.set('folder', activeFolder === '' ? '__root__' : activeFolder);
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
    [authedRequest, effectiveType, sort, search, activeFolder],
  );

  const loadFolders = useCallback(async () => {
    try {
      const res = await authedRequest<{ folders: Folder[]; rootCount: number; totalCount: number }>('/api/media/folders');
      setFolders(res.folders);
      setRootCount(res.rootCount);
      setTotalCount(res.totalCount);
    } catch { /* ignore */ }
  }, [authedRequest]);

  // (Re)load on filter/sort/search/folder change (debounced for search).
  useEffect(() => {
    const t = setTimeout(() => void load(1, true), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { void loadFolders(); }, [loadFolders]);

  // Autofocus search shortly after open.
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // ESC (closes a sub-layer first, then the library) + lock background scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Let the viewer / sub-dialogs handle Esc themselves; only close the
      // library when nothing is layered on top of it.
      if (viewerIndex !== null || renaming || movingId !== null || newFolderOpen) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, viewerIndex, renaming, movingId, newFolderOpen]);

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
  }, [allowImages, options.kind, activeFolder]);

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

    const uploadFolder = activeFolder ?? ''; // land in the open folder (root if All/Uncategorized)
    setUploadingCount(accepted.length);
    const uploaded: MediaItem[] = [];
    try {
      for (const file of accepted) {
        const res = await uploadToCloudinary(file, options.kind, sign);
        // Record directly (not uploadAndRecord) so a quota 403 surfaces here.
        try {
          const { media } = await authedRequest<{ media: MediaItem }>('/api/media', {
            method: 'POST',
            body: {
              publicId: res.publicId, url: res.url, resourceType: res.resourceType, kind: options.kind,
              folder: uploadFolder, filename: res.filename, bytes: res.bytes, format: res.format,
              width: res.width, height: res.height,
            },
          });
          uploaded.push(media);
        } catch (e) {
          if (e instanceof ApiException && e.code === 'storage_exceeded') {
            setError('You ran out of storage. Free up space on the Media page or buy more to keep uploading.');
            break;
          }
          throw e;
        }
        setUploadingCount((n) => Math.max(0, n - 1));
      }
      // A single upload from a picker is almost always "use this now".
      if (uploaded.length === 1) {
        options.onSelect(uploaded[0]);
        onClose();
        return;
      }
      if (uploaded.length) {
        await load(1, true);
        void loadFolders();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingCount(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function choose(media: MediaItem) {
    options.onSelect(media);
    onClose();
  }

  async function deleteOne(media: MediaItem) {
    if (!window.confirm(`Delete "${media.filename || 'this asset'}"? It will be removed from your library and storage.`)) {
      return;
    }
    try {
      await authedRequest(`/api/media/${media.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== media.id));
      setUsage((u) => ({ totalBytes: Math.max(0, u.totalBytes - media.bytes), totalCount: Math.max(0, u.totalCount - 1) }));
      void loadFolders();
    } catch {
      setError('Could not delete that asset.');
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

  async function doRename() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      const { media: updated } = await authedRequest<{ media: MediaItem }>(`/api/media/${renaming.id}`, {
        method: 'PATCH',
        body: { filename: name },
      });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setRenaming(null);
    } catch {
      setError('Could not rename that asset.');
    }
  }

  async function moveTo(folder: string) {
    const id = movingId;
    if (!id) return;
    try {
      await authedRequest(`/api/media/${id}`, { method: 'PATCH', body: { folder } });
      setMovingId(null);
      await load(1, true);
      void loadFolders();
    } catch {
      setError('Could not move that asset.');
      setMovingId(null);
    }
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await authedRequest('/api/media/folders', { method: 'POST', body: { name } });
      setNewFolderOpen(false);
      setNewFolderName('');
      setActiveFolder(name);
      await loadFolders();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not create folder.');
    }
  }

  const acceptAttr = accept === 'image' ? 'image/*' : undefined;
  const title = options.title ?? (accept === 'file' ? 'Select a file' : 'Select media');
  const showTabs = accept === 'all';
  const empty = !loading && items.length === 0 && uploadingCount === 0;
  const viewerItem = viewerIndex !== null ? items[viewerIndex] ?? null : null;

  const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'image', label: 'Images' },
    { value: 'file', label: 'Files' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex w-full animate-scale-in flex-col bg-white shadow-lift',
          'max-h-[92dvh] rounded-t-3xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-3xl',
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
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTypeTab(t.value)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                      typeTab === t.value ? 'bg-white text-ink shadow-xs' : 'text-neutral-500 hover:text-ink',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-brand-500 focus:bg-white"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="flex rounded-xl border border-line bg-surface-muted p-0.5">
              <button type="button" onClick={() => setView('grid')} title="Grid view" className={cn('grid h-8 w-8 place-items-center rounded-lg transition', view === 'grid' ? 'bg-white text-brand-600 shadow-xs' : 'text-neutral-400 hover:text-ink')}><IconGrid size={16} /></button>
              <button type="button" onClick={() => setView('list')} title="List view" className={cn('grid h-8 w-8 place-items-center rounded-lg transition', view === 'list' ? 'bg-white text-brand-600 shadow-xs' : 'text-neutral-400 hover:text-ink')}><IconList size={16} /></button>
            </div>
          </div>

          {/* Folder chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FolderChip active={activeFolder === null} onClick={() => setActiveFolder(null)}>All <Count>{totalCount}</Count></FolderChip>
            <FolderChip active={activeFolder === ''} onClick={() => setActiveFolder('')}><IconFolder size={13} /> Uncategorized <Count>{rootCount}</Count></FolderChip>
            {folders.map((f) => (
              <FolderChip key={f.id} active={activeFolder === f.name} onClick={() => setActiveFolder(f.name)}>
                <IconFolder size={13} /> {f.name} <Count>{f.count}</Count>
              </FolderChip>
            ))}
            <button
              type="button"
              onClick={() => { setNewFolderName(''); setNewFolderOpen(true); }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-neutral-500 transition hover:border-brand-400 hover:text-brand-600"
            >
              + New
            </button>
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
              <p className="mt-4 text-sm font-semibold text-ink">{search ? 'No matches' : 'Nothing here yet'}</p>
              <p className="mt-1 max-w-xs text-sm text-neutral-500">
                {search ? 'Try a different search term.' : 'Drag & drop, paste, or upload a file — it will appear here, ready to reuse anywhere.'}
              </p>
            </div>
          ) : view === 'grid' ? (
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
                  : items.map((m, i) => (
                      <PickerTile
                        key={m.id}
                        media={m}
                        copied={copiedId === m.id}
                        onChoose={() => choose(m)}
                        onView={() => setViewerIndex(i)}
                        onCopy={() => void copyUrl(m)}
                        onMove={() => setMovingId(m.id)}
                        onRename={() => { setRenaming(m); setRenameValue(m.filename || ''); }}
                        onDelete={() => void deleteOne(m)}
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
          ) : (
            <>
              <div className="space-y-1.5">
                {items.map((m, i) => (
                  <PickerRow
                    key={m.id}
                    media={m}
                    copied={copiedId === m.id}
                    onChoose={() => choose(m)}
                    onView={() => setViewerIndex(i)}
                    onCopy={() => void copyUrl(m)}
                    onMove={() => setMovingId(m.id)}
                    onRename={() => { setRenaming(m); setRenameValue(m.filename || ''); }}
                    onDelete={() => void deleteOne(m)}
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

        {/* Footer: usage */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7">
          <p className="text-xs text-neutral-500">
            {usage.totalCount} item{usage.totalCount === 1 ? '' : 's'} · {formatBytes(usage.totalBytes)} used
          </p>
          <p className="hidden text-xs text-neutral-400 sm:block">Click an item to select it · open it for a full preview</p>
        </div>
      </div>

      {/* Full-screen viewer with a "Use this file" action */}
      {viewerItem && (
        <MediaViewer
          item={viewerItem}
          index={viewerIndex ?? 0}
          total={items.length}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((i) => (i === null ? i : Math.max(0, i - 1)))}
          onNext={() => setViewerIndex((i) => (i === null ? i : Math.min(items.length - 1, i + 1)))}
          onCopy={() => void copyUrl(viewerItem)}
          copied={copiedId === viewerItem.id}
          onRename={() => { setRenaming(viewerItem); setRenameValue(viewerItem.filename || ''); }}
          onDelete={async () => { const it = viewerItem; setViewerIndex(null); await deleteOne(it); }}
          onUse={() => choose(viewerItem)}
          getPreviewUrl={(it) => authedRequest<{ url: string }>(`/api/media/${it.id}/file-url`).then((r) => r.url)}
          previewOnly
        />
      )}

      {/* Rename dialog */}
      {renaming && (
        <PickerDialog title="Rename file" onClose={() => setRenaming(null)}>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void doRename(); }}
            autoFocus
            className="mt-4 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setRenaming(null)} className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-ink">Cancel</button>
            <button onClick={() => void doRename()} disabled={!renameValue.trim()} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">Save</button>
          </div>
        </PickerDialog>
      )}

      {/* Move dialog */}
      {movingId !== null && (
        <PickerDialog title="Move to folder" onClose={() => setMovingId(null)}>
          <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
            <button onClick={() => void moveTo('')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-surface-muted">
              <IconFolder size={16} className="text-neutral-400" /> Uncategorized
            </button>
            {folders.map((f) => (
              <button key={f.id} onClick={() => void moveTo(f.name)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-surface-muted">
                <IconFolder size={16} className="text-brand-500" /> {f.name}
                <span className="ml-auto text-xs text-neutral-400">{f.count}</span>
              </button>
            ))}
            {folders.length === 0 && <p className="px-3 py-4 text-center text-sm text-neutral-400">No folders yet — create one first.</p>}
          </div>
        </PickerDialog>
      )}

      {/* New folder dialog */}
      {newFolderOpen && (
        <PickerDialog title="New folder" onClose={() => setNewFolderOpen(false)}>
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createFolder(); }}
            placeholder="Folder name"
            autoFocus
            className="mt-4 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setNewFolderOpen(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-ink">Cancel</button>
            <button onClick={() => void createFolder()} disabled={!newFolderName.trim()} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">Create</button>
          </div>
        </PickerDialog>
      )}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Folder chip                                                         */
/* ------------------------------------------------------------------ */

function FolderChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition',
        active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-neutral-600 hover:bg-brand-50 hover:text-brand-600',
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: ReactNode }) {
  return <span className="text-[11px] opacity-70">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Picker tile (grid)                                                  */
/* ------------------------------------------------------------------ */

function PickerTile({
  media, copied, onChoose, onView, onCopy, onMove, onRename, onDelete,
}: {
  media: MediaItem;
  copied: boolean;
  onChoose: () => void;
  onView: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-white transition hover:border-brand-400 hover:shadow-soft">
      <button type="button" onClick={onChoose} className="block aspect-square w-full" title={`Select ${media.filename || 'this file'}`}>
        <Thumb item={media} />
      </button>

      {/* Hover: select hint + quick view */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5 opacity-0 transition group-hover:opacity-100">
        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">Select</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="pointer-events-auto rounded-full bg-white/90 p-1.5 text-neutral-600 shadow-sm transition hover:bg-white hover:text-ink"
          aria-label="Preview"
          title="Preview"
        >
          <IconEye size={13} />
        </button>
      </div>

      <div className="px-2 pt-2">
        <div className="truncate text-xs font-semibold text-[#1a1c3a]" title={media.filename}>{media.filename || media.publicId.split('/').pop()}</div>
        <div className="text-2xs text-neutral-400">{formatBytes(media.bytes)}</div>
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-0.5 border-t border-line px-1 py-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
        <TileAction title="Copy URL" onClick={onCopy}>{copied ? <IconCheck size={14} className="text-success-600" /> : <IconCopy size={14} />}</TileAction>
        <TileAction title="Move to folder" onClick={onMove}><IconFolder size={14} /></TileAction>
        <TileAction title="Rename" onClick={onRename}><IconPencil size={14} /></TileAction>
        <TileAction title="Delete" onClick={onDelete} danger><IconTrash size={14} /></TileAction>
      </div>
    </div>
  );
}

function TileAction({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn('rounded-md p-1.5 text-neutral-500 transition hover:bg-surface-muted', danger ? 'hover:text-danger-600' : 'hover:text-brand-600')}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Picker row (list)                                                   */
/* ------------------------------------------------------------------ */

function PickerRow({
  media, copied, onChoose, onView, onCopy, onMove, onRename, onDelete,
}: {
  media: MediaItem;
  copied: boolean;
  onChoose: () => void;
  onView: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-line px-2.5 py-2 transition hover:border-brand-400 hover:bg-brand-50/30">
      <button type="button" onClick={onChoose} className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" title="Select">
        <Thumb item={media} rounded="rounded-lg" />
      </button>
      <button type="button" onClick={onChoose} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold text-[#1a1c3a]" title={media.filename}>{media.filename || media.publicId.split('/').pop()}</div>
        <div className="text-xs text-neutral-400">{(media.format || media.resourceType).toUpperCase()} · {formatBytes(media.bytes)} · {formatDate(media.createdAt)}</div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
        <TileAction title="Preview" onClick={onView}><IconEye size={15} /></TileAction>
        <TileAction title="Copy URL" onClick={onCopy}>{copied ? <IconCheck size={15} className="text-success-600" /> : <IconCopy size={15} />}</TileAction>
        <TileAction title="Move to folder" onClick={onMove}><IconFolder size={15} /></TileAction>
        <TileAction title="Rename" onClick={onRename}><IconPencil size={15} /></TileAction>
        <TileAction title="Delete" onClick={onDelete} danger><IconTrash size={15} /></TileAction>
      </div>
    </div>
  );
}
