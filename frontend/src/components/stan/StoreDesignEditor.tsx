'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { ThemeCarousel } from '@/components/stan/ThemeCarousel';
import { DesignControlsPanel } from '@/components/stan/DesignControlsPanel';
import { StoreCanvas, type SFItem, type SFProfile } from '@/storefront/renderer/StoreCanvas';
import { STORE_TEMPLATES } from '@/storefront/templates/registry';
import type { StoreTemplate } from '@/storefront/templates/types';
import { demoForTemplate } from '@/storefront/templates/demos';
import type { StoreThemeInput } from '@/storefront/runtime/theme';
import { hydrateBlocks, defaultStoreBlocks } from '@/storefront';
import type { Block } from '@/storefront/schema/types';
import { IconCheck } from '@/components/icons';
import type { CreatorProfile, StorefrontConfig } from '@/lib/types';

type BuilderTheme = StoreThemeInput & { templateId: string };

const DEFAULT_SOCIALS = [
  { platform: 'youtube', url: '#' },
  { platform: 'tiktok', url: '#' },
  { platform: 'instagram', url: '#' },
  { platform: 'linkedin', url: '#' },
];

function demoItemsFor(templateId: string) {
  const demo = demoForTemplate(templateId) ?? demoForTemplate('studio');
  return {
    products: demo?.products ?? [],
    courses: demo?.courses ?? [],
    bookingTypes: demo?.bookingTypes ?? [],
    leads: [] as SFItem[],
  };
}

function demoProfile(base: CreatorProfile, templateId: string): SFProfile {
  const demo = demoForTemplate(templateId);
  return {
    username: base.username,
    displayName: demo?.profile?.displayName ?? base.displayName,
    category: demo?.profile?.category ?? base.category,
    bio: demo?.profile?.bio ?? base.bio,
    avatarUrl: base.avatarUrl,
    socialLinks: base.socialLinks?.length ? base.socialLinks : DEFAULT_SOCIALS,
  };
}

export function StoreDesignEditor() {
  const { authedRequest } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [theme, setTheme] = useState<BuilderTheme>({
    fontPair: 'default',
    background: '#ffffff',
    accent: '#5865f2',
    accent2: '',
    buttonStyle: 'solid',
    cardStyle: 'shadow',
    backgroundStyle: 'solid',
    spacing: 'comfortable',
    cardChrome: 'elevated',
    motion: 'subtle',
    templateId: '',
  });
  const [blocks, setBlocks] = useState<Block[]>(defaultStoreBlocks());
  const [items, setItems] = useState(demoItemsFor('studio'));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

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

    const [p, s, prod] = await Promise.all([
      authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile'),
      authedRequest<{ storefront: StorefrontConfig }>('/api/creator/storefront'),
      authedRequest<{ products: Record<string, unknown>[] }>('/api/products').catch(() => ({ products: [] })),
    ]);

    if (p.profile) setProfile(p.profile);

    const products = prod.products.filter((x) => x.type !== 'lead_magnet').map((x) => mapItem(x, 'digital'));
    const leads = prod.products.filter((x) => x.type === 'lead_magnet').map((x) => mapItem(x, 'lead_magnet'));

    // The creator's real sections — preview must reflect them, not template demos.
    // Only fall back to a template's starter layout if the store has no blocks yet.
    const savedBlocks = s.storefront.blocks?.length ? hydrateBlocks(s.storefront.blocks) : null;

    if (s.storefront.theme) {
      const loaded = { ...s.storefront.theme } as BuilderTheme;
      const match =
        STORE_TEMPLATES.find((t) => t.id === loaded.templateId) ??
        STORE_TEMPLATES.find((t) => t.theme.background === loaded.background && t.theme.accent === loaded.accent);
      const templateId = match?.id ?? loaded.templateId ?? 'studio';
      setTheme((t) => ({ ...t, ...loaded, templateId }));
      setBlocks(savedBlocks ?? defaultStoreBlocks());
      if (!products.length && !leads.length) setItems(demoItemsFor(templateId));
    } else {
      setTheme((t) => ({ ...t, templateId: 'studio' }));
      setBlocks(savedBlocks ?? defaultStoreBlocks());
      if (!products.length && !leads.length) setItems(demoItemsFor('studio'));
    }

    if (products.length || leads.length) {
      setItems({
        products: products.length ? products : demoItemsFor('studio').products,
        courses: [],
        bookingTypes: [],
        leads,
      });
    }

    setReady(true);
    setDirty(false);
  }, [authedRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sections that exist at most once; collections render their whole catalog.
  const SINGLE_TYPES = ['header', 'product', 'course', 'booking', 'leadMagnet', 'links', 'emailCapture'];
  const COLLECTION_TYPES = ['product', 'course', 'booking', 'leadMagnet'];

  function applyTemplate(t: StoreTemplate) {
    // Reproduce the template's LOOK so the store matches the carousel screenshot:
    // its section ORDER (e.g. booking-first themes) and per-section styling +
    // theme — while PRESERVING the creator's content: their actual items, custom
    // section titles, item order, and any extra content sections they added.
    // Never duplicate (a template's multi-card product blocks collapse to one)
    // and never drop a section that holds the creator's items.
    const built = t.build();
    setTheme((prev) => ({ ...prev, ...t.theme, templateId: t.id } as BuilderTheme));
    setBlocks((prev) => {
      const existingByType = new Map<string, Block>();
      const contentBlocks: Block[] = [];
      for (const b of prev) {
        if (SINGLE_TYPES.includes(b.type)) {
          if (!existingByType.has(b.type)) existingByType.set(b.type, b);
        } else {
          contentBlocks.push(b);
        }
      }
      const result: Block[] = [];
      const used = new Set<string>();
      // Lay sections out in the template's order, styled by the template.
      for (const tb of built) {
        if (!SINGLE_TYPES.includes(tb.type)) {
          result.push(tb);
          continue;
        }
        if (used.has(tb.type)) continue; // collapse a template's duplicate product blocks
        used.add(tb.type);
        const { startIndex: _s, maxItems: _m, title: _t, itemOrder: _o, ...style } =
          tb.config as Record<string, unknown>;
        const existing = existingByType.get(tb.type);
        if (existing) {
          // Keep the creator's title + item order; apply the template's styling.
          result.push({ ...existing, config: { ...existing.config, ...style } });
        } else {
          const cfg = { ...(tb.config as Record<string, unknown>) };
          if (COLLECTION_TYPES.includes(tb.type)) {
            delete cfg.startIndex;
            delete cfg.maxItems;
          }
          result.push({ ...tb, config: cfg });
        }
      }
      // Keep any of the creator's sections the template didn't mention (so their
      // courses/bookings/etc. are never hidden), then their content sections.
      for (const [type, b] of existingByType) if (!used.has(type)) result.push(b);
      result.push(...contentBlocks);
      return result;
    });
    setSaved(false);
    setDirty(true);
  }

  function touch() {
    setSaved(false);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      // Persist the visual theme AND the layout blocks so the chosen theme's
      // design (header style, card layout, sections) is what visitors see.
      await authedRequest('/api/creator/storefront', {
        method: 'PATCH',
        body: {
          theme,
          blocks: blocks.map((b) => ({ id: b.id, type: b.type, visible: b.visible !== false, config: b.config })),
        },
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save design');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    void load();
  }

  if (!ready || !profile) {
    return <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />;
  }

  return (
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:gap-12">
      {/* Left column — full-width carousel, controls in a centered stack below */}
      <div className="flex w-full flex-col">
        {/* Theme carousel spans the full column width */}
        <ThemeCarousel
          templates={STORE_TEMPLATES}
          activeId={theme.templateId || 'studio'}
          onSelect={applyTemplate}
        />

        <div className="w-full">
          <DesignControlsPanel
            accent={theme.accent ?? '#5865f2'}
            background={theme.background ?? '#ffffff'}
            fontPair={theme.fontPair ?? 'default'}
            onAccentChange={(v) => {
              setTheme((t) => ({ ...t, accent: v }));
              touch();
            }}
            onBackgroundChange={(v) => {
              setTheme((t) => ({ ...t, background: v, backgroundStyle: 'flat' }));
              touch();
            }}
            onFontChange={(v) => {
              setTheme((t) => ({ ...t, fontPair: v }));
              touch();
            }}
          />

          {error && (
            <div className="mt-4">
              <Alert kind="error">{error}</Alert>
            </div>
          )}

          <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancel}
            disabled={!dirty || saving}
            className="rounded-full border border-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:border-neutral-200 disabled:text-neutral-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(88,101,242,0.55)] transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : saved ? (
              <>
                <IconCheck size={15} /> Saved
              </>
            ) : (
              'Save'
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="mx-auto w-full xl:sticky xl:top-8 xl:mx-0">
        <p className="mb-3 hidden text-center text-2xs font-semibold uppercase tracking-widest text-neutral-400 xl:block">
          Live preview
        </p>
        <PhoneFrame className="mx-auto max-w-[340px]" contentClassName="pt-8">
          <StoreCanvas
            mode="preview"
            profile={demoProfile(profile, theme.templateId || 'studio')}
            theme={theme}
            blocks={blocks}
            products={[...items.products, ...items.leads]}
            courses={items.courses}
            bookingTypes={items.bookingTypes}
          />
        </PhoneFrame>
      </div>
    </div>
  );
}
