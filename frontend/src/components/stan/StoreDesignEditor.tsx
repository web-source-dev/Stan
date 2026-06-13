'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { ThemeCarousel } from '@/components/stan/ThemeCarousel';
import { DesignControlsPanel } from '@/components/stan/DesignControlsPanel';
import { StoreCanvas, type SFItem, type SFProfile } from '@/storefront/renderer/StoreCanvas';
import { STORE_TEMPLATES, getTemplate } from '@/storefront/templates/registry';
import type { StoreTemplate } from '@/storefront/templates/types';
import { demoForTemplate } from '@/storefront/templates/demos';
import type { StoreThemeInput } from '@/storefront/runtime/theme';
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
  const [blocks, setBlocks] = useState<Block[]>(() => getTemplate('studio')?.build() ?? []);
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

    if (s.storefront.theme) {
      const loaded = { ...s.storefront.theme } as BuilderTheme;
      const match =
        STORE_TEMPLATES.find((t) => t.id === loaded.templateId) ??
        STORE_TEMPLATES.find((t) => t.theme.background === loaded.background && t.theme.accent === loaded.accent);
      const templateId = match?.id ?? loaded.templateId ?? 'studio';
      setTheme((t) => ({ ...t, ...loaded, templateId }));
      const tpl = getTemplate(templateId);
      if (tpl) setBlocks(tpl.build());
      if (!products.length && !leads.length) setItems(demoItemsFor(templateId));
    } else {
      setTheme((t) => ({ ...t, templateId: 'studio' }));
      const tpl = getTemplate('studio');
      if (tpl) setBlocks(tpl.build());
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

  function applyTemplate(t: StoreTemplate) {
    setTheme((prev) => ({ ...prev, ...t.theme, templateId: t.id } as BuilderTheme));
    setBlocks(t.build());
    setItems(demoItemsFor(t.id));
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
      {/* Left column — centered stack */}
      <div className="mx-auto flex w-full max-w-lg flex-col">
        <ThemeCarousel
          templates={STORE_TEMPLATES}
          activeId={theme.templateId || 'studio'}
          onSelect={applyTemplate}
        />

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

      {/* Live preview */}
      <div className="mx-auto w-full xl:sticky xl:top-8 xl:mx-0">
        <p className="mb-3 hidden text-center text-2xs font-semibold uppercase tracking-widest text-neutral-400 xl:block">
          Live preview
        </p>
        <PhoneFrame className="mx-auto max-w-[340px]">
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
