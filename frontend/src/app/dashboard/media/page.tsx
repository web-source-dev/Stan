'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Modal } from '@/components/Modal';
import { Badge, Skeleton, Alert } from '@/components/ui';
import { uploadToCloudinary, type SignKind, type MediaItem } from '@/lib/upload';
import { emitPlanChanged } from '@/lib/plan-events';
import { cn } from '@/lib/cn';
import {
  IconImage, IconUpload, IconTrash, IconCopy, IconPencil, IconCheck, IconX, IconPlus,
  IconFolder, IconGrid, IconList,
} from '@/components/icons';
import {
  type TypeFilter, type Sort, type Folder,
  TYPE_TABS, SORTS, formatBytes, formatDate, signKindFor,
  Thumb, MediaViewer, MoveModal, FolderBar,
} from '@/components/media/parts';

const CARD = 'rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)]';
const INPUT = 'w-full rounded-xl border border-line-strong bg-white px-4 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand-500';

interface Overview {
  usedBytes: number;
  count: number;
  tier: string;
  baseBytes: number | null;
  extraBytes: number;
  quotaBytes: number | null;
  unlimited: boolean;
  remainingBytes: number | null;
}

interface StoragePack {
  key: 'gb5' | 'gb20' | 'gb80';
  bytes: number;
  cents: number;
  label: string;
}

/* ------------------------------------------------------------------ */
/* Storage usage header                                                */
/* ------------------------------------------------------------------ */

function UsageBar({ overview, onBuy }: { overview: Overview | null; onBuy: () => void }) {
  if (!overview) return <Skeleton className="h-28 w-full rounded-3xl" />;
  const pct = overview.unlimited || !overview.quotaBytes
    ? 0
    : Math.min(100, Math.round((overview.usedBytes / overview.quotaBytes) * 100));
  const danger = pct >= 90;
  const warn = pct >= 75 && pct < 90;

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Storage</h2>
            <Badge tone="brand">{overview.tier} plan</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {formatBytes(overview.usedBytes)} of {overview.unlimited ? 'unlimited' : formatBytes(overview.quotaBytes)} used
            {' · '}{overview.count} file{overview.count === 1 ? '' : 's'}
            {overview.extraBytes > 0 && ` · includes ${formatBytes(overview.extraBytes)} extra`}
          </p>
        </div>
        <button onClick={onBuy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700 sm:w-auto">
          <IconPlus size={16} /> Buy more storage
        </button>
      </div>
      {!overview.unlimited && (
        <div className="mt-4">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={cn('h-full rounded-full transition-all', danger ? 'bg-danger-500' : warn ? 'bg-amber-500' : 'bg-brand-600')}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          {danger && <p className="mt-2 text-xs font-semibold text-danger-600">You&apos;re almost out of storage. Delete files or buy more to keep uploading.</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buy-storage modal                                                   */
/* ------------------------------------------------------------------ */

function BuyStorageModal({ open, packs, onClose, onPurchased }: {
  open: boolean;
  packs: StoragePack[];
  onClose: () => void;
  onPurchased: () => void;
}) {
  const { authedRequest } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function buy(pack: StoragePack) {
    setError(''); setBusy(pack.key);
    try {
      const res = await authedRequest<{ demo?: boolean; url?: string }>('/api/subscription/storage/purchase', {
        method: 'POST',
        body: { pack: pack.key },
      });
      if (res.url) { window.location.href = res.url; return; } // live Stripe checkout
      emitPlanChanged();
      onPurchased();
      onClose();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Purchase failed');
    } finally { setBusy(null); }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Buy more storage</h2>
        <p className="mt-1.5 text-sm text-neutral-500">One-time purchase — added to your library permanently.</p>
      </div>
      {error && <Alert kind="error" className="mt-4">{error}</Alert>}
      <div className="mt-6 space-y-3">
        {packs.map((p) => (
          <div key={p.key} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4">
            <div>
              <div className="text-base font-bold text-[#1a1c3a]">{p.label}</div>
              <div className="text-sm text-neutral-500">extra storage</div>
            </div>
            <button
              onClick={() => buy(p)}
              disabled={busy !== null}
              className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy === p.key ? 'Processing…' : `$${(p.cents / 100).toFixed(0)}`}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Media tile + row                                                    */
/* ------------------------------------------------------------------ */

function Tile({ item, selected, onToggle, onOpen, onCopy, onMove, onRename, onDelete, copied }: {
  item: MediaItem;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
  copied: boolean;
}) {
  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border bg-white transition', selected ? 'border-brand-600 ring-2 ring-brand-200' : 'border-line hover:border-line-strong')}>
      <button onClick={onToggle} className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md border border-line-strong bg-white/90 shadow-sm">
        {selected && <IconCheck size={14} className="text-brand-600" />}
      </button>
      <button onClick={onOpen} className="block aspect-square w-full" title="View"><Thumb item={item} /></button>
      <div className="p-2.5">
        <div className="truncate text-xs font-semibold text-[#1a1c3a]" title={item.filename}>{item.filename || item.publicId.split('/').pop()}</div>
        <div className="text-2xs text-neutral-400">{formatBytes(item.bytes)}</div>
      </div>
      <div className="flex items-center justify-end gap-0.5 border-t border-line px-1.5 py-1.5 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
        <button onClick={onCopy} title="Copy URL" className="rounded-md p-1.5 text-neutral-500 transition hover:bg-surface-muted hover:text-brand-600">
          {copied ? <IconCheck size={15} className="text-success-600" /> : <IconCopy size={15} />}
        </button>
        <button onClick={onMove} title="Move to folder" className="rounded-md p-1.5 text-neutral-500 transition hover:bg-surface-muted hover:text-brand-600"><IconFolder size={15} /></button>
        <button onClick={onRename} title="Rename" className="rounded-md p-1.5 text-neutral-500 transition hover:bg-surface-muted hover:text-brand-600"><IconPencil size={15} /></button>
        <button onClick={onDelete} title="Delete" className="rounded-md p-1.5 text-neutral-500 transition hover:bg-surface-muted hover:text-danger-600"><IconTrash size={15} /></button>
      </div>
    </div>
  );
}

/** One row in list view. */
function Row({ item, selected, onToggle, onOpen, onCopy, onMove, onRename, onDelete, copied }: {
  item: MediaItem;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
  copied: boolean;
}) {
  return (
    <div className={cn('group flex items-center gap-3 rounded-xl border px-2.5 py-2 transition', selected ? 'border-brand-600 bg-brand-50/40' : 'border-line hover:bg-surface-subtle')}>
      <button onClick={onToggle} className="grid h-5 w-5 shrink-0 place-items-center rounded border border-line-strong bg-white">
        {selected && <IconCheck size={13} className="text-brand-600" />}
      </button>
      <button onClick={onOpen} className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" title="View"><Thumb item={item} rounded="rounded-lg" /></button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold text-[#1a1c3a]" title={item.filename}>{item.filename || item.publicId.split('/').pop()}</div>
        <div className="text-xs text-neutral-400">{(item.format || item.resourceType).toUpperCase()} · {formatBytes(item.bytes)} · {formatDate(item.createdAt)}</div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
        <button onClick={onCopy} title="Copy URL" className="rounded-md p-2 text-neutral-500 transition hover:bg-surface-muted hover:text-brand-600">{copied ? <IconCheck size={15} className="text-success-600" /> : <IconCopy size={15} />}</button>
        <button onClick={onMove} title="Move to folder" className="rounded-md p-2 text-neutral-500 transition hover:bg-surface-muted hover:text-brand-600"><IconFolder size={15} /></button>
        <button onClick={onRename} title="Rename" className="rounded-md p-2 text-neutral-500 transition hover:bg-surface-muted hover:text-brand-600"><IconPencil size={15} /></button>
        <button onClick={onDelete} title="Delete" className="rounded-md p-2 text-neutral-500 transition hover:bg-surface-muted hover:text-danger-600"><IconTrash size={15} /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function MediaManager() {
  const { authedRequest } = useAuth();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [packs, setPacks] = useState<StoragePack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [buyOpen, setBuyOpen] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [uploads, setUploads] = useState<{ name: string; pct: number; status: 'uploading' | 'done' | 'error' }[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // Folders: activeFolder null = All, '' = Uncategorized (root), name = that folder.
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootCount, setRootCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'rename'; id?: string; value: string } | null>(null);

  const sign = useCallback(
    (kind: SignKind, bytes?: number) =>
      authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        '/api/cloudinary/sign-upload',
        { method: 'POST', body: { kind, bytes } },
      ),
    [authedRequest],
  );

  const loadOverview = useCallback(async () => {
    try { setOverview(await authedRequest<Overview>('/api/media/usage')); } catch { /* ignore */ }
  }, [authedRequest]);

  const loadPacks = useCallback(async () => {
    try {
      const res = await authedRequest<{ storagePacks: StoragePack[] }>('/api/subscription');
      setPacks(res.storagePacks ?? []);
    } catch { /* ignore */ }
  }, [authedRequest]);

  const loadFolders = useCallback(async () => {
    try {
      const res = await authedRequest<{ folders: Folder[]; rootCount: number; totalCount: number }>('/api/media/folders');
      setFolders(res.folders);
      setRootCount(res.rootCount);
      setTotalCount(res.totalCount);
    } catch { /* ignore */ }
  }, [authedRequest]);

  const load = useCallback(async (p: number, replace: boolean) => {
    const params = new URLSearchParams({ type, sort, page: String(p), limit: '40' });
    if (search.trim()) params.set('search', search.trim());
    if (activeFolder !== null) params.set('folder', activeFolder === '' ? '__root__' : activeFolder);
    const res = await authedRequest<{ items: MediaItem[]; total: number; hasMore: boolean }>(`/api/media?${params}`);
    setItems((prev) => (replace || !prev ? res.items : [...prev, ...res.items]));
    setTotal(res.total);
    setHasMore(res.hasMore);
    setPage(p);
  }, [authedRequest, type, sort, search, activeFolder]);

  // Append the next page; guarded so the observer can't fire overlapping loads.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try { await load(page + 1, false); } finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, page, load]);

  // Reload list on filter/sort/search/folder change (debounced for search).
  useEffect(() => {
    setSelected(new Set());
    const t = setTimeout(() => { void load(1, true); }, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => { void loadOverview(); void loadPacks(); void loadFolders(); }, [loadOverview, loadPacks, loadFolders]);

  // Infinite scroll: auto-load the next page when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: '400px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(''); setUploadNote(''); setUploading(true);
    const arr = Array.from(files);
    setUploads(arr.map((f) => ({ name: f.name, pct: 0, status: 'uploading' as const })));
    const setTask = (i: number, patch: Partial<{ pct: number; status: 'uploading' | 'done' | 'error' }>) =>
      setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, ...patch } : u)));
    const quota = overview && !overview.unlimited ? overview.quotaBytes : null;
    const uploadFolder = activeFolder ?? ''; // new uploads land in the open folder
    let runningUsed = overview?.usedBytes ?? 0;
    let added = 0;
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        // Client-side pre-check to avoid a wasted upload when clearly over quota.
        if (quota !== null && runningUsed + file.size > quota) {
          setTask(i, { status: 'error' });
          setUploadNote(`Not enough storage for "${file.name}". Buy more storage to continue.`);
          setBuyOpen(true);
          break;
        }
        const kind = signKindFor(file);
        try {
          const r = await uploadToCloudinary(file, kind, (k) => sign(k, file.size), (pct) => setTask(i, { pct }));
          // Record directly (not uploadAndRecord) so a quota 403 surfaces here.
          const { media } = await authedRequest<{ media: MediaItem }>('/api/media', {
            method: 'POST',
            body: {
              publicId: r.publicId, url: r.url, resourceType: r.resourceType, kind, folder: uploadFolder,
              filename: r.filename, bytes: r.bytes, format: r.format, width: r.width, height: r.height,
            },
          });
          setItems((prev) => [media, ...(prev ?? [])]);
          runningUsed += media.bytes;
          added += 1;
          setTask(i, { pct: 100, status: 'done' });
        } catch (e) {
          setTask(i, { status: 'error' });
          if (e instanceof ApiException && e.code === 'storage_exceeded') {
            setUploadNote('You ran out of storage. Buy more to keep uploading.');
            setBuyOpen(true);
            break;
          }
          setUploadNote(e instanceof Error ? e.message : `Failed to upload "${file.name}"`);
        }
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
      if (added > 0) { void loadOverview(); void loadFolders(); }
      // Leave the final 100% / done state visible briefly, then clear.
      setTimeout(() => setUploads([]), 1500);
    }
  }

  /* ---- Folders ---- */
  async function saveFolder() {
    if (!folderModal) return;
    const name = folderModal.value.trim();
    if (!name) return;
    try {
      if (folderModal.mode === 'create') {
        await authedRequest('/api/media/folders', { method: 'POST', body: { name } });
        setActiveFolder(name);
      } else {
        await authedRequest(`/api/media/folders/${folderModal.id}`, { method: 'PATCH', body: { name } });
        if (activeFolder && folderModal.id) setActiveFolder(name);
      }
      setFolderModal(null);
      await loadFolders();
      await load(1, true);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not save folder');
    }
  }

  async function deleteFolder(f: Folder) {
    if (!confirm(`Delete folder "${f.name}"? Its ${f.count} file${f.count === 1 ? '' : 's'} will move to Uncategorized.`)) return;
    try {
      await authedRequest(`/api/media/folders/${f.id}`, { method: 'DELETE' });
      if (activeFolder === f.name) setActiveFolder(null);
      await loadFolders();
      await load(1, true);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not delete folder');
    }
  }

  /* ---- Move ---- */
  async function moveTo(folder: string) {
    const ids = moveIds;
    if (!ids) return;
    for (const id of ids) {
      try { await authedRequest(`/api/media/${id}`, { method: 'PATCH', body: { folder } }); } catch { /* keep going */ }
    }
    setMoveIds(null);
    setSelected(new Set());
    await load(1, true);
    await loadFolders();
  }

  async function copyUrl(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500);
    } catch { /* ignore */ }
  }

  async function doRename() {
    if (!renaming) return;
    try {
      const { media } = await authedRequest<{ media: MediaItem }>(`/api/media/${renaming.id}`, {
        method: 'PATCH', body: { filename: renameValue.trim() },
      });
      setItems((prev) => prev?.map((m) => (m.id === media.id ? media : m)) ?? null);
      setRenaming(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Rename failed');
    }
  }

  async function deleteOne(item: MediaItem) {
    if (!confirm(`Delete "${item.filename || 'this file'}"? This can't be undone.`)) return;
    try {
      await authedRequest(`/api/media/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev?.filter((m) => m.id !== item.id) ?? null);
      setSelected((s) => { const n = new Set(s); n.delete(item.id); return n; });
      setTotal((t) => Math.max(0, t - 1));
      void loadOverview();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Delete failed');
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} file${selected.size === 1 ? '' : 's'}? This can't be undone.`)) return;
    const ids = Array.from(selected);
    for (const id of ids) {
      try { await authedRequest(`/api/media/${id}`, { method: 'DELETE' }); } catch { /* keep going */ }
    }
    setItems((prev) => prev?.filter((m) => !selected.has(m.id)) ?? null);
    setTotal((t) => Math.max(0, t - ids.length));
    setSelected(new Set());
    void loadOverview();
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const allSelected = useMemo(() => items != null && items.length > 0 && items.every((m) => selected.has(m.id)), [items, selected]);
  const viewerItem = viewerIndex !== null && items ? items[viewerIndex] ?? null : null;

  return (
    <div className="space-y-5">
      <UsageBar overview={overview} onBuy={() => setBuyOpen(true)} />

      {/* Toolbar */}
      <div className={cn(CARD, 'space-y-3')}>
        {/* Row 1: search + upload (always full-width on mobile) */}
        <div className="flex items-center gap-2">
          <input className={cn(INPUT, 'flex-1')} placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
          <button onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-60 sm:px-5">
            <IconUpload size={16} />
            <span className="hidden sm:inline">{uploading ? `Uploading ${uploads.filter((u) => u.status !== 'uploading').length}/${uploads.length}…` : 'Upload'}</span>
          </button>
        </div>
        {/* Row 2: filters — horizontally scrollable so it never breaks on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 rounded-full bg-surface-subtle p-1">
            {TYPE_TABS.map((t) => (
              <button key={t.value} onClick={() => setType(t.value)} className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition', type === t.value ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-ink')}>{t.label}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="shrink-0 rounded-xl border border-line-strong bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand-500">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="ml-auto flex shrink-0 rounded-full bg-surface-subtle p-1">
            <button onClick={() => setView('grid')} title="Grid view" className={cn('grid h-8 w-8 place-items-center rounded-full transition', view === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-400 hover:text-ink')}><IconGrid size={16} /></button>
            <button onClick={() => setView('list')} title="List view" className={cn('grid h-8 w-8 place-items-center rounded-full transition', view === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-400 hover:text-ink')}><IconList size={16} /></button>
          </div>
        </div>
      </div>

      {/* Folder bar */}
      <div className={cn(CARD, 'py-4')}>
        <FolderBar
          folders={folders}
          activeFolder={activeFolder}
          totalCount={totalCount}
          rootCount={rootCount}
          onSelect={setActiveFolder}
          onNew={() => setFolderModal({ mode: 'create', value: '' })}
          onRename={(f) => setFolderModal({ mode: 'rename', id: f.id, value: f.name })}
          onDelete={deleteFolder}
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className={cn(CARD, 'space-y-2.5 py-4')}>
          {uploads.map((u, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-[#1a1c3a]">{u.name}</span>
                <span className={cn('shrink-0 font-semibold', u.status === 'error' ? 'text-danger-600' : u.status === 'done' ? 'text-success-600' : 'text-neutral-500')}>
                  {u.status === 'error' ? 'Failed' : u.status === 'done' ? 'Done ✓' : `${u.pct}%`}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={cn('h-full rounded-full transition-all', u.status === 'error' ? 'bg-danger-500' : u.status === 'done' ? 'bg-success-500' : 'bg-brand-600')}
                  style={{ width: `${u.status === 'error' ? 100 : u.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadNote && <Alert kind="warn">{uploadNote}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 sm:px-5">
          <span className="text-sm font-semibold text-brand-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-ink">Clear</button>
            <button onClick={() => setMoveIds(Array.from(selected))} className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"><IconFolder size={14} /> Move</button>
            <button onClick={deleteSelected} className="inline-flex items-center gap-1.5 rounded-full bg-danger-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-danger-700"><IconTrash size={14} /> Delete</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className={CARD}>
        {items != null && items.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-neutral-500">{total} file{total === 1 ? '' : 's'}</span>
            <button onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((m) => m.id)))} className="text-sm font-semibold text-brand-600 hover:underline">
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}

        {items === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><IconImage size={30} /></div>
            <h3 className="text-lg font-bold text-[#1a1c3a]">{search ? 'No matching files' : 'Your library is empty'}</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">{search ? 'Try a different search.' : 'Upload images, files and videos to reuse them anywhere in your store.'}</p>
            {!search && (
              <button onClick={() => fileInput.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700"><IconUpload size={16} /> Upload</button>
            )}
          </div>
        ) : (
          <>
            {view === 'grid' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {items.map((m, i) => (
                  <Tile
                    key={m.id}
                    item={m}
                    selected={selected.has(m.id)}
                    copied={copiedId === m.id}
                    onToggle={() => toggle(m.id)}
                    onOpen={() => setViewerIndex(i)}
                    onCopy={() => copyUrl(m)}
                    onMove={() => setMoveIds([m.id])}
                    onRename={() => { setRenaming(m); setRenameValue(m.filename || ''); }}
                    onDelete={() => deleteOne(m)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((m, i) => (
                  <Row
                    key={m.id}
                    item={m}
                    selected={selected.has(m.id)}
                    copied={copiedId === m.id}
                    onToggle={() => toggle(m.id)}
                    onOpen={() => setViewerIndex(i)}
                    onCopy={() => copyUrl(m)}
                    onMove={() => setMoveIds([m.id])}
                    onRename={() => { setRenaming(m); setRenameValue(m.filename || ''); }}
                    onDelete={() => deleteOne(m)}
                  />
                ))}
              </div>
            )}
            {/* Infinite-scroll sentinel + loading state */}
            {hasMore && <div ref={sentinelRef} aria-hidden className="h-8" />}
            {loadingMore && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-600" /> Loading more…
              </div>
            )}
            {!hasMore && items.length >= 40 && (
              <div className="mt-6 text-center text-xs text-neutral-400">You&apos;ve reached the end · {total} files</div>
            )}
          </>
        )}
      </div>

      {/* Rename modal */}
      <Modal open={renaming !== null} onClose={() => setRenaming(null)} size="sm">
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">Rename file</h2>
        <input className={cn(INPUT, 'mt-4')} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doRename(); }} autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setRenaming(null)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-ink"><IconX size={14} /> Cancel</button>
          <button onClick={doRename} disabled={!renameValue.trim()} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">Save</button>
        </div>
      </Modal>

      {/* Viewer / lightbox */}
      {viewerItem && (
        <MediaViewer
          item={viewerItem}
          index={viewerIndex ?? 0}
          total={items?.length ?? 1}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((i) => (i === null ? i : Math.max(0, i - 1)))}
          onNext={() => setViewerIndex((i) => (i === null ? i : Math.min((items?.length ?? 1) - 1, i + 1)))}
          onCopy={() => copyUrl(viewerItem)}
          copied={copiedId === viewerItem.id}
          onRename={() => { setRenaming(viewerItem); setRenameValue(viewerItem.filename || ''); }}
          onDelete={async () => { const it = viewerItem; setViewerIndex(null); await deleteOne(it); }}
          getPreviewUrl={(it) => authedRequest<{ url: string }>(`/api/media/${it.id}/file-url`).then((r) => r.url)}
          previewOnly
        />
      )}

      {/* Move to folder */}
      <MoveModal
        open={moveIds !== null}
        count={moveIds?.length ?? 0}
        folders={folders}
        current={activeFolder}
        onClose={() => setMoveIds(null)}
        onMove={moveTo}
      />

      {/* Create / rename folder */}
      <Modal open={folderModal !== null} onClose={() => setFolderModal(null)} size="sm">
        <h2 className="text-lg font-bold tracking-tight text-[#1a1c3a]">{folderModal?.mode === 'rename' ? 'Rename folder' : 'New folder'}</h2>
        <input
          className={cn(INPUT, 'mt-4')}
          placeholder="Folder name"
          value={folderModal?.value ?? ''}
          onChange={(e) => setFolderModal((f) => (f ? { ...f, value: e.target.value } : f))}
          onKeyDown={(e) => { if (e.key === 'Enter') void saveFolder(); }}
          autoFocus
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setFolderModal(null)} className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-ink">Cancel</button>
          <button onClick={saveFolder} disabled={!folderModal?.value.trim()} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">{folderModal?.mode === 'rename' ? 'Save' : 'Create'}</button>
        </div>
      </Modal>

      <BuyStorageModal open={buyOpen} packs={packs} onClose={() => setBuyOpen(false)} onPurchased={() => { void loadOverview(); }} />
    </div>
  );
}

export default function MediaPage() {
  return (
    <DashboardShell title="Media Library" subtitle="Manage every image, file and video in your store.">
      <MediaManager />
    </DashboardShell>
  );
}
