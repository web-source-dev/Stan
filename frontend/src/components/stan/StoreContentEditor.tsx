'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { ProfileEditModal } from '@/components/stan/ProfileEditModal';
import { SectionSettingsModal } from '@/components/stan/SectionSettingsModal';
import {
  StoreCanvas,
  type SFItem,
  BLOCK_DEFS,
  ADDABLE_BLOCKS,
  createBlock,
  hydrateBlocks,
  defaultStoreBlocks,
  applyItemOrder,
  type Block,
  type BlockType,
} from '@/storefront';
import { formatPrice, type CreatorProfile, type StorefrontConfig, type StorefrontTheme } from '@/lib/types';
import {
  IconPencil,
  IconPlus,
  IconFolder,
  IconBook,
  IconGraduationCap,
  IconCalendar,
  IconLink,
  IconDownload,
  IconEye,
  IconTrash,
  IconArrowRight,
  IconBolt,
  IconDollar,
  IconPlay,
  IconChart,
  IconSparkles,
  IconMail,
} from '@/components/icons';
import { cn } from '@/lib/cn';

/** Config key each block type uses for its display/section title (null = not renamable). */
function titleKey(type: BlockType): string | null {
  switch (type) {
    case 'product':
    case 'course':
    case 'booking':
    case 'leadMagnet':
    case 'links':
    case 'faq':
    case 'gallery':
      return 'title';
    case 'emailCapture':
      return 'heading';
    case 'heading':
    case 'text':
      return 'text';
    case 'hero':
    case 'featured':
      return 'headline';
    case 'button':
      return 'label';
    default:
      return null;
  }
}

type DragPayload = { kind: 'section' | 'item'; id: string; blockId?: string };

function bucketForBlock(b: Block): 'products' | 'courses' | 'bookingTypes' | 'leads' | null {
  switch (b.type) {
    case 'product': return 'products';
    case 'course': return 'courses';
    case 'booking': return 'bookingTypes';
    case 'leadMagnet': return 'leads';
    default: return null;
  }
}

/** Extended item metadata for the store editor list. */
type StoreItem = SFItem & {
  status?: string;
  productKind?: string;
};

/** Where clicking a store item should take the creator to manage it. */
function itemEditHref(blockType: BlockType, item: StoreItem): string | null {
  switch (blockType) {
    case 'product':
    case 'leadMagnet':
      if (item.productKind === 'webinar') return `/dashboard/webinars/${item.id}/edit`;
      return `/dashboard/products/${item.id}/edit`;
    case 'course':
      return `/dashboard/courses/${item.id}/edit`;
    case 'booking':
      return `/dashboard/bookings/${item.id}/edit`;
    default:
      return null;
  }
}

/** Where the empty-state "Add" button for an offer section should go. */
function addItemHref(blockType: BlockType): string | null {
  switch (blockType) {
    case 'product':
      return '/dashboard/products/new';
    case 'leadMagnet':
      return '/dashboard/products/new?kind=lead_magnet';
    case 'course':
      return '/dashboard/courses/new';
    case 'booking':
      return '/dashboard/bookings/new';
    default:
      return null;
  }
}

const ADD_ITEM_LABEL: Partial<Record<BlockType, string>> = {
  product: 'Add a product',
  leadMagnet: 'Add a free resource',
  course: 'Create a course',
  booking: 'Set up a booking',
};

/**
 * Sections that represent a single store-wide collection/widget — only one of
 * each makes sense (a second renders the identical content). Content blocks
 * (heading, text, hero, …) can repeat freely.
 */
const UNIQUE_TYPES: BlockType[] = ['product', 'course', 'booking', 'leadMagnet', 'links', 'emailCapture'];

/** The four collection sections, paired with the item bucket that feeds them. */
const COLLECTION_TYPES: { type: BlockType; bucket: 'products' | 'courses' | 'bookingTypes' | 'leads' }[] = [
  { type: 'product', bucket: 'products' },
  { type: 'course', bucket: 'courses' },
  { type: 'booking', bucket: 'bookingTypes' },
  { type: 'leadMagnet', bucket: 'leads' },
];

function sectionTitle(b: Block): string {
  const key = titleKey(b.type);
  const v = key ? b.config?.[key] : undefined;
  if (v) return String(v);
  return BLOCK_DEFS[b.type]?.label ?? b.type;
}

/** Stan store tab — default section label when unset. */
function sectionDisplayTitle(b: Block): string {
  const key = titleKey(b.type);
  const v = key ? b.config?.[key] : undefined;
  if (v && String(v).trim()) return String(v);
  if (['product', 'course', 'booking', 'leadMagnet'].includes(b.type)) return 'New Section';
  return sectionTitle(b);
}

function itemIconStyle(blockType: BlockType, item?: StoreItem) {
  const kind = item?.productKind;
  if (kind === 'stan_affiliate') return { Icon: IconDollar, bg: 'bg-[#dbeafe] text-[#2563eb]' };
  if (kind === 'url_media') return { Icon: IconLink, bg: 'bg-[#fce7f3] text-[#db2777]' };
  if (kind === 'membership') return { Icon: IconBolt, bg: 'bg-[#ecfccb] text-[#65a30d]' };
  if (kind === 'webinar') return { Icon: IconPlay, bg: 'bg-[#f3f4f6] text-[#6b7280]' };
  if (kind === 'custom') return { Icon: IconSparkles, bg: 'bg-[#fef9c3] text-[#ca8a04]' };
  switch (blockType) {
    case 'leadMagnet':
      return { Icon: IconBook, bg: 'bg-[#dcfce7] text-[#16a34a]' };
    case 'course':
      return { Icon: IconGraduationCap, bg: 'bg-[#ede9fe] text-[#7c3aed]' };
    case 'booking':
      return { Icon: IconCalendar, bg: 'bg-[#ccfbf1] text-[#0d9488]' };
    default:
      return { Icon: IconFolder, bg: 'bg-[#ffedd5] text-[#ea580c]' };
  }
}

/** Type-indicator glyph shown right after a product's title (Stan reference). */
function typeIndicatorIcon(blockType: BlockType, item?: StoreItem) {
  const kind = item?.productKind;
  if (kind === 'url_media' || kind === 'stan_affiliate') return IconLink;
  if (kind === 'membership') return IconBolt;
  if (kind === 'webinar') return IconPlay;
  if (blockType === 'course') return IconGraduationCap;
  if (blockType === 'booking') return IconCalendar;
  if (blockType === 'leadMagnet') return IconMail;
  return IconDownload;
}

/** 2×3 dot drag handle matching Stan's grip (stroke #6875A1, 17×24). */
function StanGrip() {
  return (
    <svg width="16" height="22" viewBox="0 0 17 24" fill="none" aria-hidden className="text-[#6875a1]">
      {[[5, 5], [12, 5], [5, 12], [12, 12], [5, 19], [12, 19]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Vertical 3-dot overflow trigger (Stan dropdown icon). */
function StanMenuDots() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

export function StoreContentEditor({
  profile,
  onProfileUpdated,
}: {
  profile: CreatorProfile;
  onProfileUpdated?: (p: CreatorProfile) => void;
}) {
  const { authedRequest } = useAuth();
  const router = useRouter();
  const [profileState, setProfileState] = useState<CreatorProfile>(profile);
  const [theme, setTheme] = useState<StorefrontTheme | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(defaultStoreBlocks());
  const [items, setItems] = useState<{ products: SFItem[]; courses: SFItem[]; bookingTypes: SFItem[]; leads: SFItem[] }>({
    products: [], courses: [], bookingTypes: [], leads: [],
  });
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const dragRef = useRef<DragPayload | null>(null);
  const [draggingKey, setDraggingKey] = useState('');
  const [dragOverKey, setDragOverKey] = useState('');
  const draggedRef = useRef(false);
  const [menuId, setMenuId] = useState('');
  const [itemMenuId, setItemMenuId] = useState('');
  const [renamingId, setRenamingId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const mapItem = (x: Record<string, unknown>, type: string): StoreItem => ({
      id: String(x.id),
      title: String(x.title),
      slug: String(x.slug ?? x.id),
      shortDescription: String(x.shortDescription ?? x.description ?? ''),
      priceCents: Number(x.priceCents ?? 0),
      currency: String(x.currency ?? 'usd'),
      coverImageUrl: String(x.coverImageUrl ?? ''),
      ctaLabel: x.ctaLabel ? String(x.ctaLabel) : undefined,
      type: String(x.type ?? type),
      status: x.status ? String(x.status) : 'draft',
      productKind: x.productKind ? String(x.productKind) : undefined,
    });

    const [s, prod, crs, bk, wbs] = await Promise.all([
      authedRequest<{ storefront: StorefrontConfig }>('/api/creator/storefront'),
      authedRequest<{ products: Record<string, unknown>[] }>('/api/products').catch(() => ({ products: [] })),
      authedRequest<{ courses: Record<string, unknown>[] }>('/api/courses').catch(() => ({ courses: [] })),
      authedRequest<{ bookingTypes: Record<string, unknown>[] }>('/api/booking-types').catch(() => ({ bookingTypes: [] })),
      authedRequest<{ webinars: Record<string, unknown>[] }>('/api/webinars').catch(() => ({ webinars: [] })),
    ]);

    if (s.storefront.theme) setTheme(s.storefront.theme);
    setBlocks(s.storefront.blocks?.length ? hydrateBlocks(s.storefront.blocks) : defaultStoreBlocks());
    const webinarItems = wbs.webinars.map((w) => mapItem({ ...w, productKind: 'webinar', type: 'digital' }, 'digital'));
    setItems({
      products: [
        ...prod.products.filter((p) => p.type !== 'lead_magnet').map((p) => mapItem(p, 'digital')),
        ...webinarItems,
      ],
      courses: crs.courses.map((c) => mapItem(c, 'course')),
      bookingTypes: bk.bookingTypes.map((b) => mapItem(b, 'booking')),
      leads: prod.products.filter((p) => p.type === 'lead_magnet').map((p) => mapItem(p, 'lead_magnet')),
    });
    setReady(true);
  }, [authedRequest]);

  useEffect(() => { void load(); }, [load]);

  async function save(nextBlocks: Block[]) {
    await authedRequest('/api/creator/storefront', {
      method: 'PATCH',
      body: {
        ...(theme ? { theme } : {}),
        blocks: nextBlocks.map((b) => ({ id: b.id, type: b.type, visible: b.visible !== false, config: b.config })),
      },
    });
  }

  function reorderSections(fromId: string, toId: string) {
    if (fromId === toId) return;
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === fromId);
      const to = bs.findIndex((b) => b.id === toId);
      if (from < 1 || to < 1) return bs;
      const next = [...bs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void save(next);
      return next;
    });
  }

  function reorderItems(blockId: string, fromId: string, toId: string) {
    if (fromId === toId) return;
    mutateBlock(blockId, (b) => {
      const bucket = bucketForBlock(b);
      if (!bucket) return b;
      const raw = items[bucket] as StoreItem[];
      const ordered = applyItemOrder(raw, b.config?.itemOrder);
      const from = ordered.findIndex((i) => i.id === fromId);
      const to = ordered.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return b;
      const next = [...ordered];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...b, config: { ...b.config, itemOrder: next.map((i) => i.id) } };
    });
  }

  function onDragStart(payload: DragPayload, key: string) {
    return (e: DragEvent) => {
      dragRef.current = payload;
      draggedRef.current = false;
      setDraggingKey(key);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', payload.id);
    };
  }

  function onDragEnd() {
    dragRef.current = null;
    setDraggingKey('');
    setDragOverKey('');
    window.setTimeout(() => { draggedRef.current = false; }, 0);
  }

  function onDragOverDropKey(key: string) {
    return (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverKey(key);
    };
  }

  function onDropSection(sectionId: string) {
    return (e: DragEvent) => {
      e.preventDefault();
      setDragOverKey('');
      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingKey('');
      draggedRef.current = true;
      if (!drag || drag.kind !== 'section') return;
      reorderSections(drag.id, sectionId);
    };
  }

  function onDropItem(blockId: string, itemId: string, sectionId?: string) {
    return (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverKey('');
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.kind === 'section') {
        dragRef.current = null;
        setDraggingKey('');
        draggedRef.current = true;
        reorderSections(drag.id, sectionId ?? blockId);
        return;
      }
      dragRef.current = null;
      setDraggingKey('');
      draggedRef.current = true;
      if (drag.blockId !== blockId) return;
      reorderItems(blockId, drag.id, itemId);
    };
  }

  function rawRowsForBlock(b: Block): StoreItem[] {
    switch (b.type) {
      case 'product': return items.products as StoreItem[];
      case 'course': return items.courses as StoreItem[];
      case 'booking': return items.bookingTypes as StoreItem[];
      case 'leadMagnet': return items.leads as StoreItem[];
      default: return [];
    }
  }

  function rowsForBlock(b: Block): StoreItem[] {
    return applyItemOrder(rawRowsForBlock(b), b.config?.itemOrder);
  }

  function addSection(type: BlockType) {
    setBlocks((bs) => {
      // Never add a second copy of a unique collection/widget section.
      if (UNIQUE_TYPES.includes(type) && bs.some((b) => b.type === type)) return bs;
      const next = [...bs, createBlock(type)];
      void save(next);
      return next;
    });
    setAddSectionOpen(false);
  }

  /** Apply a transform to a single block by id, persist, and update state. */
  function mutateBlock(id: string, fn: (b: Block) => Block) {
    setBlocks((bs) => {
      const next = bs.map((b) => (b.id === id ? fn(b) : b));
      void save(next);
      return next;
    });
  }

  function toggleVisible(id: string) {
    mutateBlock(id, (b) => ({ ...b, visible: b.visible === false }));
    setMenuId('');
  }

  function removeSection(id: string) {
    setBlocks((bs) => {
      const next = bs.filter((b) => b.id !== id);
      void save(next);
      return next;
    });
    setMenuId('');
  }

  /** Move a content block one step up or down (never past the pinned header at index 0). */
  function moveSection(id: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 1 || j < 1 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      void save(next);
      return next;
    });
    setMenuId('');
  }

  function startRename(b: Block) {
    setRenamingId(b.id);
    setRenameValue(sectionTitle(b));
    setMenuId('');
  }

  function commitRename(b: Block) {
    const key = titleKey(b.type);
    const value = renameValue.trim();
    if (key && value) mutateBlock(b.id, (x) => ({ ...x, config: { ...x.config, [key]: value } }));
    setRenamingId('');
  }

  function handleSectionSave(id: string, config: Record<string, unknown>) {
    mutateBlock(id, (b) => ({ ...b, config }));
    setEditingBlockId('');
  }

  function handleProfileSaved(p: CreatorProfile) {
    setProfileState(p);
    onProfileUpdated?.(p);
  }

  const contentBlocks = blocks.filter((b) => b.type !== 'header');
  const presentTypes = new Set(blocks.map((b) => b.type));

  // Hide unique sections that already exist from the "Add Section" menu, then
  // split the rest into Offers vs Content for a clearer picker.
  const addable = ADDABLE_BLOCKS.filter((t) => !(UNIQUE_TYPES.includes(t) && presentTypes.has(t)));
  const offerAddable = addable.filter((t) => BLOCK_DEFS[t].category === 'offers');
  const contentAddable = addable.filter((t) => BLOCK_DEFS[t].category === 'content');

  // Items that exist but have no section to show them (e.g. their section was deleted).
  const orphanTypes = COLLECTION_TYPES.filter(({ type, bucket }) => items[bucket].length > 0 && !presentTypes.has(type));
  const orphanCount = orphanTypes.reduce((n, { bucket }) => n + items[bucket].length, 0);

  function showOrphans() {
    setBlocks((bs) => {
      const next = [...bs, ...orphanTypes.map(({ type }) => createBlock(type))];
      void save(next);
      return next;
    });
  }

  if (!ready) {
    return <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />;
  }

  return (
    <>
      <div className="my-store-layout">
        {/* ---- Editor column ---- */}
        <div className="min-w-0">
          {/* Profile header */}
          <div className="my-store-profile">
            <Avatar
              src={profileState.avatarUrl}
              name={profileState.displayName}
              size={80}
              className="ring-4 ring-white shadow-[0_2px_12px_rgba(15,15,25,0.08)]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-[1.375rem] font-bold leading-tight text-[#131f60]">
                  {profileState.displayName || profileState.username}
                </h2>
                <button type="button" onClick={() => setEditProfileOpen(true)} className="my-store-icon-btn" title="Edit profile">
                  <IconPencil size={15} />
                </button>
              </div>
              <p className="mt-0.5 text-[15px] text-neutral-500">@{profileState.username}</p>
            </div>
          </div>

          {orphanCount > 0 && (
            <div className="my-store-orphan">
              <div className="min-w-0 flex-1 text-sm text-amber-800">
                You have {orphanCount} {orphanCount === 1 ? 'item' : 'items'} that{' '}
                {orphanCount === 1 ? 'isn’t' : 'aren’t'} shown in any section.
              </div>
              <button type="button" onClick={showOrphans} className="my-store-orphan-btn">
                Show {orphanTypes.length === 1 ? 'section' : 'sections'}
              </button>
            </div>
          )}

          {/* Individual cards — Stan reference */}
          <div className="my-store-stack">
            {contentBlocks.map((b) => {
              const offerRows = rowsForBlock(b);
              const isOffer = ['product', 'course', 'booking', 'leadMagnet'].includes(b.type);
              // Don't surface offer sections that have no items yet — keep the
              // store simple by only showing sections the creator has filled.
              // (Products are added via "+ Add Product"; courses/bookings from
              // their own pages — the section appears once it has an item.)
              if (isOffer && offerRows.length === 0) return null;
              const hidden = b.visible === false;
              const canRename = titleKey(b.type) !== null;
              const addHref = addItemHref(b.type);

              return (
                <Fragment key={b.id}>
                  {/* Section card */}
                  <div
                    className={cn(
                      'my-store-card my-store-card--section',
                      hidden && 'opacity-60',
                      draggingKey === `section:${b.id}` && 'opacity-50',
                      dragOverKey === `section:${b.id}` && 'my-store-card--drop-target',
                    )}
                    onDragOver={onDragOverDropKey(`section:${b.id}`)}
                    onDragLeave={() => setDragOverKey('')}
                    onDrop={onDropSection(b.id)}
                  >
                    <span
                      draggable
                      onDragStart={onDragStart({ kind: 'section', id: b.id }, `section:${b.id}`)}
                      onDragEnd={onDragEnd}
                      className="my-store-grip"
                      title="Drag to reorder section"
                    >
                      <StanGrip />
                    </span>

                    {renamingId === b.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(b)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(b);
                          if (e.key === 'Escape') setRenamingId('');
                        }}
                        className="my-store-rename-input"
                      />
                    ) : (
                      <button
                        type="button"
                        onDoubleClick={() => canRename && startRename(b)}
                        className="my-store-section-label"
                        title={canRename ? 'Double-click to rename' : undefined}
                      >
                        <span className="truncate">{sectionDisplayTitle(b)}</span>
                        {hidden && <span className="my-store-badge my-store-badge--muted">Hidden</span>}
                      </button>
                    )}

                    <div className="relative ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => { setMenuId((id) => (id === b.id ? '' : b.id)); setItemMenuId(''); }}
                        className="my-store-icon-btn"
                        aria-label="Section options"
                      >
                        <StanMenuDots />
                      </button>
                      {menuId === b.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuId('')} />
                          <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1 shadow-lift">
                            <button
                              type="button"
                              onClick={() => { setEditingBlockId(b.id); setMenuId(''); }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                            >
                              <IconPencil size={15} className="text-neutral-400" /> Edit content
                            </button>
                            {canRename && (
                              <button
                                type="button"
                                onClick={() => startRename(b)}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                              >
                                <IconPencil size={15} className="text-neutral-400" /> Rename
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleVisible(b.id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                            >
                              <IconEye size={15} className="text-neutral-400" /> {hidden ? 'Show' : 'Hide'}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(b.id, -1)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                            >
                              <IconArrowRight size={15} className="-rotate-90 text-neutral-400" /> Move up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(b.id, 1)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                            >
                              <IconArrowRight size={15} className="rotate-90 text-neutral-400" /> Move down
                            </button>
                            <div className="my-1 border-t border-line" />
                            <button
                              type="button"
                              onClick={() => removeSection(b.id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
                            >
                              <IconTrash size={15} /> Delete section
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {isOffer && offerRows.length === 0 && (
                    <div className={cn('my-store-card my-store-card--empty', hidden && 'opacity-60')}>
                      <p className="text-sm text-neutral-400">No items yet in this section.</p>
                      {addHref && (
                        <button
                          type="button"
                          onClick={() => router.push(addHref)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-100"
                        >
                          <IconPlus size={15} /> {ADD_ITEM_LABEL[b.type] ?? 'Add item'}
                        </button>
                      )}
                    </div>
                  )}

                  {isOffer && offerRows.map((item) => {
                    const href = itemEditHref(b.type, item);
                    const { Icon, bg } = itemIconStyle(b.type, item);
                    const TypeIcon = typeIndicatorIcon(b.type, item);
                    const isDraft = item.status !== 'published';
                    const menuKey = `${b.id}:${item.id}`;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'my-store-card my-store-card--product',
                          hidden && 'opacity-60',
                          href && 'cursor-pointer',
                          draggingKey === `item:${b.id}:${item.id}` && 'opacity-50',
                          dragOverKey === `item:${b.id}:${item.id}` && 'my-store-card--drop-target',
                        )}
                        onDragOver={onDragOverDropKey(`item:${b.id}:${item.id}`)}
                        onDragLeave={() => setDragOverKey('')}
                        onDrop={onDropItem(b.id, item.id, b.id)}
                        onClick={() => {
                          if (draggedRef.current || !href) return;
                          router.push(href);
                        }}
                      >
                        <span
                          draggable
                          onDragStart={onDragStart({ kind: 'item', id: item.id, blockId: b.id }, `item:${b.id}:${item.id}`)}
                          onDragEnd={onDragEnd}
                          onClick={(e) => e.stopPropagation()}
                          className="my-store-grip"
                          title="Drag to reorder"
                        >
                          <StanGrip />
                        </span>

                        {item.coverImageUrl ? (
                          <img src={item.coverImageUrl} alt="" className="my-store-thumb-img" />
                        ) : (
                          <span className={cn('my-store-thumb', bg)}>
                            <Icon size={18} />
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[16px] font-bold leading-snug text-[#131f60]">{item.title}</span>
                            <TypeIcon size={18} className="shrink-0 text-[#131f60]" />
                          </div>
                          {item.priceCents > 0 && (
                            <p className="mt-0.5 text-[13px] font-medium text-neutral-500">
                              {formatPrice(item.priceCents, item.currency)}
                              {item.productKind === 'membership' ? '/Month' : ''}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                          {isDraft && <span className="my-store-badge my-store-badge--draft">Draft</span>}
                          {!isDraft && (
                            <span className="text-[#131f60]">
                              <IconChart size={18} />
                            </span>
                          )}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => { setItemMenuId((id) => (id === menuKey ? '' : menuKey)); setMenuId(''); }}
                              className="my-store-icon-btn"
                              aria-label="Product options"
                            >
                              <StanMenuDots />
                            </button>
                            {itemMenuId === menuKey && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setItemMenuId('')} />
                                <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-line bg-white p-1 shadow-lift">
                                  {href && (
                                    <Link
                                      href={href}
                                      onClick={() => setItemMenuId('')}
                                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                                    >
                                      <IconPencil size={15} className="text-neutral-400" /> Edit
                                    </Link>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!isOffer && (
                    <div className={cn('my-store-card my-store-card--product', hidden && 'opacity-60')}>
                      <span className="my-store-grip">
                        <StanGrip />
                      </span>
                      {(() => {
                        const { Icon, bg } = itemIconStyle(b.type);
                        return (
                          <span className={cn('my-store-thumb', bg)}>
                            <Icon size={18} />
                          </span>
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <span className="text-[15px] font-semibold text-ink">{sectionDisplayTitle(b)}</span>
                        <p className="text-[13px] text-neutral-400">Edit this section&apos;s content</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingBlockId(b.id)}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          <div className="my-store-actions">
            <Link href="/dashboard/products/new" className="my-store-add-product">
              + Add Product
            </Link>
            <div className="relative text-center">
              <button
                type="button"
                onClick={() => setAddSectionOpen((o) => !o)}
                className="my-store-add-section"
              >
                Add Section
              </button>
              {addSectionOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setAddSectionOpen(false)} />
                  <div className="absolute bottom-full left-1/2 z-30 mb-2 max-h-[60vh] w-64 -translate-x-1/2 overflow-y-auto rounded-xl border border-line bg-white p-1.5 text-left shadow-lift">
                    {offerAddable.length > 0 && (
                      <>
                        <div className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-neutral-400">
                          Offers
                        </div>
                        {offerAddable.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => addSection(t)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                          >
                            <span>{BLOCK_DEFS[t].emoji}</span>
                            {BLOCK_DEFS[t].label}
                          </button>
                        ))}
                      </>
                    )}
                    <div className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-neutral-400">
                      Content
                    </div>
                    {contentAddable.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => addSection(t)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted"
                      >
                        <span>{BLOCK_DEFS[t].emoji}</span>
                        {BLOCK_DEFS[t].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ---- Phone preview ---- */}
        <div className="my-store-preview">
          <PhoneFrame maxWidth={380}>
            <StoreCanvas
              mode="preview"
              profile={{
                username: profileState.username,
                displayName: profileState.displayName,
                category: profileState.category,
                bio: profileState.bio,
                avatarUrl: profileState.avatarUrl,
                socialLinks: profileState.socialLinks ?? [],
              }}
              theme={theme}
              blocks={blocks}
              products={[...items.products, ...items.leads]}
              courses={items.courses}
              bookingTypes={items.bookingTypes}
            />
          </PhoneFrame>
        </div>
      </div>

      <ProfileEditModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profileState}
        onSaved={handleProfileSaved}
      />
      <SectionSettingsModal
        block={blocks.find((b) => b.id === editingBlockId) ?? null}
        onClose={() => setEditingBlockId('')}
        onSave={handleSectionSave}
      />
    </>
  );
}
