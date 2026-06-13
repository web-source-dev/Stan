'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { ProductTypePicker } from '@/components/stan/ProductTypePicker';
import {
  StoreCanvas,
  type SFItem,
  BLOCK_DEFS,
  ADDABLE_BLOCKS,
  createBlock,
  hydrateBlocks,
  defaultStoreBlocks,
  type Block,
  type BlockType,
} from '@/storefront';
import { formatPrice, type CreatorProfile, type StorefrontConfig, type StorefrontTheme } from '@/lib/types';
import {
  IconGrip,
  IconDots,
  IconPencil,
  IconPlus,
  IconBox,
  IconBook,
  IconCalendar,
  IconMagnet,
  IconMail,
  IconLink,
  IconDownload,
} from '@/components/icons';
import { cn } from '@/lib/cn';

function blockIcon(type: BlockType) {
  switch (type) {
    case 'product': return IconBox;
    case 'course': return IconBook;
    case 'booking': return IconCalendar;
    case 'leadMagnet': return IconMagnet;
    case 'emailCapture': return IconMail;
    case 'links': return IconLink;
    default: return IconBox;
  }
}

function sectionTitle(b: Block): string {
  const cfg = b.config;
  if (cfg?.title) return cfg.title as string;
  return BLOCK_DEFS[b.type]?.label ?? b.type;
}

export function StoreContentEditor({
  profile,
  onEditDesign,
}: {
  profile: CreatorProfile;
  onEditDesign: () => void;
}) {
  const { authedRequest } = useAuth();
  const [theme, setTheme] = useState<StorefrontTheme | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(defaultStoreBlocks());
  const [items, setItems] = useState<{ products: SFItem[]; courses: SFItem[]; bookingTypes: SFItem[]; leads: SFItem[] }>({
    products: [], courses: [], bookingTypes: [], leads: [],
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [draggingId, setDraggingId] = useState('');
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const mapItem = (x: Record<string, unknown>, type: string): SFItem => ({
      id: String(x.id),
      title: String(x.title),
      slug: String(x.slug ?? x.id),
      shortDescription: String(x.shortDescription ?? x.description ?? ''),
      priceCents: Number(x.priceCents ?? 0),
      currency: String(x.currency ?? 'usd'),
      coverImageUrl: String(x.coverImageUrl ?? ''),
      ctaLabel: x.ctaLabel ? String(x.ctaLabel) : undefined,
      type: String(x.type ?? type),
    });

    const [s, prod, crs, bk] = await Promise.all([
      authedRequest<{ storefront: StorefrontConfig }>('/api/creator/storefront'),
      authedRequest<{ products: Record<string, unknown>[] }>('/api/products').catch(() => ({ products: [] })),
      authedRequest<{ courses: Record<string, unknown>[] }>('/api/courses').catch(() => ({ courses: [] })),
      authedRequest<{ bookingTypes: Record<string, unknown>[] }>('/api/booking-types').catch(() => ({ bookingTypes: [] })),
    ]);

    if (s.storefront.theme) setTheme(s.storefront.theme);
    setBlocks(s.storefront.blocks?.length ? hydrateBlocks(s.storefront.blocks) : defaultStoreBlocks());
    setItems({
      products: prod.products.filter((p) => p.type !== 'lead_magnet').map((p) => mapItem(p, 'digital')),
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
        theme,
        blocks: nextBlocks.map((b) => ({ id: b.id, type: b.type, visible: b.visible !== false, config: b.config })),
      },
    });
  }

  function reorder(fromId: string, toId: string) {
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

  function addSection(type: BlockType) {
    const b = createBlock(type);
    setBlocks((bs) => {
      const next = [...bs, b];
      void save(next);
      return next;
    });
    setAddSectionOpen(false);
  }

  function rowsForBlock(b: Block): SFItem[] {
    switch (b.type) {
      case 'product': return items.products;
      case 'course': return items.courses;
      case 'booking': return items.bookingTypes;
      case 'leadMagnet': return items.leads;
      default: return [];
    }
  }

  const contentBlocks = blocks.filter((b) => b.type !== 'header');

  if (!ready) {
    return <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />;
  }

  return (
    <>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---- Editor column ---- */}
        <div className="min-w-0">
          {/* Profile header — Stan store tab */}
          <div className="mb-8 flex items-center gap-4">
            <Avatar src={profile.avatarUrl} name={profile.displayName} size={72} className="ring-4 ring-white shadow-soft" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-bold text-ink">{profile.displayName || profile.username}</h2>
                <button type="button" onClick={onEditDesign} className="rounded-lg p-1.5 text-neutral-400 hover:bg-surface-muted hover:text-ink" title="Edit profile">
                  <IconPencil size={16} />
                </button>
              </div>
              <p className="text-sm font-medium text-neutral-500">@{profile.username}</p>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {contentBlocks.map((b) => {
              const Icon = blockIcon(b.type);
              const offerRows = rowsForBlock(b);
              const isOffer = ['product', 'course', 'booking', 'leadMagnet'].includes(b.type);

              return (
                <div key={b.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      draggable
                      onDragStart={() => setDraggingId(b.id)}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); reorder(draggingId, b.id); setDraggingId(''); }}
                      onDragEnd={() => setDraggingId('')}
                      className={cn('cursor-grab text-neutral-300 hover:text-neutral-500', draggingId === b.id && 'opacity-40')}
                    >
                      <IconGrip size={18} />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-neutral-600">{sectionTitle(b)}</span>
                    <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-surface-muted" aria-label="Section options">
                      <IconDots size={16} />
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,15,25,0.06)]">
                    {isOffer && offerRows.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-neutral-400">
                        No items yet — add a product to fill this section.
                      </div>
                    )}
                    {isOffer && offerRows.map((item, i) => (
                      <div
                        key={item.id}
                        className={cn(
                          'flex min-h-[56px] items-center gap-3 px-4 py-3',
                          i > 0 && 'border-t border-line',
                        )}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef0ff] text-brand-600">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
                          {item.shortDescription && (
                            <div className="truncate text-xs text-neutral-500">{item.shortDescription}</div>
                          )}
                        </div>
                        {item.priceCents > 0 && (
                          <span className="shrink-0 text-sm font-bold text-brand-600">
                            {formatPrice(item.priceCents, item.currency)}
                          </span>
                        )}
                        {b.type === 'leadMagnet' && (
                          <IconDownload size={16} className="shrink-0 text-neutral-400" />
                        )}
                        {b.type === 'emailCapture' && (
                          <IconMail size={16} className="shrink-0 text-neutral-400" />
                        )}
                      </div>
                    ))}
                    {!isOffer && (
                      <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef0ff] text-brand-600">
                          <Icon size={18} />
                        </span>
                        <span className="text-sm font-semibold text-ink">{BLOCK_DEFS[b.type]?.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 active:scale-[0.99]"
            >
              <IconPlus size={18} /> Add Product
            </button>
            <div className="relative text-center">
              <button
                type="button"
                onClick={() => setAddSectionOpen((o) => !o)}
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                Add Section
              </button>
              {addSectionOpen && (
                <div className="absolute left-1/2 z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-line bg-white p-1.5 shadow-lift">
                  {ADDABLE_BLOCKS.map((t) => (
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
              )}
            </div>
          </div>
        </div>

        {/* ---- Phone preview ---- */}
        <div className="xl:sticky xl:top-8">
          <PhoneFrame>
            <StoreCanvas
              mode="preview"
              profile={{
                username: profile.username,
                displayName: profile.displayName,
                category: profile.category,
                bio: profile.bio,
                avatarUrl: profile.avatarUrl,
                socialLinks: profile.socialLinks ?? [],
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

      <ProductTypePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
