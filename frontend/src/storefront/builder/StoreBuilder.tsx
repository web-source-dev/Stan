'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Button, Card, Field, Textarea, Select, Avatar, Badge, Alert } from '@/components/ui';
import { IconCheck, IconPlus, IconX, IconImage, IconExternal, IconTrash, IconCopy } from '@/components/icons';
import { uploadToCloudinary, type SignKind } from '@/lib/upload';
import { ADDABLE_BLOCKS, BLOCK_DEFS } from '../schema/blocks';
import type { Block, BlockType, FieldSpec } from '../schema/types';
import { defaultStoreBlocks, hydrateBlocks, createBlock } from '../runtime/hydrate';
import { FONT_PAIRS, isDarkHex, templateThumbBackground } from '../runtime/theme';
import { STORE_TEMPLATES } from '../templates/registry';
import type { StoreTemplate } from '../templates/types';
import { StoreCanvas, type SFItem } from '../renderer/StoreCanvas';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import type { StoreThemeInput } from '../runtime/theme';
import { SOCIAL_PLATFORMS, type CreatorProfile, type StorefrontConfig } from '@/lib/types';
import { cn } from '@/lib/cn';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ProfileForm {
  displayName: string; category: string; bio: string; avatarUrl: string; avatarPublicId: string;
  socialLinks: { platform: string; url: string }[];
}

const SAMPLE = {
  products: [
    { id: 's1', title: 'The Creator Playbook', slug: 's1', shortDescription: 'Everything I know about growing an audience.', priceCents: 2900, currency: 'usd', coverImageUrl: '', ctaLabel: 'Buy now', type: 'digital' },
    { id: 's2', title: 'Notion Templates Pack', slug: 's2', shortDescription: '12 templates to run your business.', priceCents: 1900, currency: 'usd', coverImageUrl: '', ctaLabel: 'Buy now', type: 'digital' },
  ] as SFItem[],
  courses: [{ id: 'c1', title: 'Launch in 30 Days', slug: 'c1', shortDescription: 'A step-by-step video course.', priceCents: 9900, currency: 'usd', coverImageUrl: '', type: 'course' }] as SFItem[],
  bookingTypes: [{ id: 'b1', title: '1:1 Strategy Call', slug: 'b1', shortDescription: '45 minutes, just you and me.', priceCents: 15000, currency: 'usd', type: 'booking' }] as SFItem[],
  leads: [{ id: 'l1', title: 'Free Starter Guide', slug: 'l1', shortDescription: 'Grab the PDF.', priceCents: 0, currency: 'usd', type: 'lead_magnet' }] as SFItem[],
};

type BuilderTheme = StoreThemeInput & { templateId: string };

export function StoreBuilder() {
  const { authedRequest } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>({ displayName: '', category: '', bio: '', avatarUrl: '', avatarPublicId: '', socialLinks: [] });
  const [theme, setTheme] = useState<BuilderTheme>({
    fontPair: 'default',
    background: '#ffffff',
    accent: '#5b54e8',
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
  const [selectedId, setSelectedId] = useState<string>('');
  const [items, setItems] = useState(SAMPLE);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  // Tracks whether the creator has edited the design since load / last template,
  // so we only warn before a template swap when there's real work to lose.
  const [customized, setCustomized] = useState(false);
  const [undoState, setUndoState] = useState<{ theme: BuilderTheme; blocks: Block[] } | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<StoreTemplate | null>(null);
  const [draggingId, setDraggingId] = useState<string>('');
  const settingsRef = useRef<HTMLDivElement>(null);
  const touch = useCallback(() => setCustomized(true), []);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      authedRequest<{ profile: CreatorProfile | null }>('/api/creator/profile'),
      authedRequest<{ storefront: StorefrontConfig }>('/api/creator/storefront'),
    ]);
    if (p.profile) {
      setProfile(p.profile);
      setPublished(p.profile.published);
      setForm({
        displayName: p.profile.displayName, category: p.profile.category, bio: p.profile.bio,
        avatarUrl: p.profile.avatarUrl, avatarPublicId: '', socialLinks: p.profile.socialLinks ?? [],
      });
      // Pull the creator's REAL products/courses/bookings (incl. drafts) for an
      // accurate preview. Empty collections fall back to samples so the creator
      // can still style sections they haven't filled yet.
      void loadRealItems();
    }
    if (s.storefront.theme) setTheme((t) => ({ ...t, ...s.storefront.theme }));
    const hydrated = s.storefront.blocks?.length ? hydrateBlocks(s.storefront.blocks) : defaultStoreBlocks();
    setBlocks(hydrated);
    setSelectedId(hydrated[0]?.id ?? '');
    setCustomized(false);
    setUndoState(null);
    setReady(true);
  }, [authedRequest]);

  const loadRealItems = useCallback(async () => {
    const mapItem = (x: any, type: string): SFItem => ({
      id: x.id, title: x.title, slug: x.slug ?? x.id,
      shortDescription: x.shortDescription ?? x.description ?? '',
      priceCents: x.priceCents ?? 0, currency: x.currency ?? 'usd',
      coverImageUrl: x.coverImageUrl ?? '', ctaLabel: x.ctaLabel, type: x.type ?? type,
    });
    const [prod, crs, bk] = await Promise.all([
      authedRequest<{ products: any[] }>('/api/products').catch(() => ({ products: [] })),
      authedRequest<{ courses: any[] }>('/api/courses').catch(() => ({ courses: [] })),
      authedRequest<{ bookingTypes: any[] }>('/api/booking-types').catch(() => ({ bookingTypes: [] })),
    ]);
    const products = prod.products.filter((p) => p.type !== 'lead_magnet').map((p) => mapItem(p, 'digital'));
    const leads = prod.products.filter((p) => p.type === 'lead_magnet').map((p) => mapItem(p, 'lead_magnet'));
    const courses = crs.courses.map((c) => mapItem(c, 'course'));
    const bookingTypes = bk.bookingTypes.map((b) => mapItem(b, 'booking'));
    setItems({
      products: products.length ? products : SAMPLE.products,
      courses: courses.length ? courses : SAMPLE.courses,
      bookingTypes: bookingTypes.length ? bookingTypes : SAMPLE.bookingTypes,
      leads: leads.length ? leads : SAMPLE.leads,
    });
  }, [authedRequest]);

  useEffect(() => { void load(); }, [load]);

  // Bring the selected block's settings into view when selection changes (e.g.
  // clicking a block on the canvas), but never on the initial mount/load.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  const sign = useCallback(
    (kind: SignKind) => authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
      '/api/cloudinary/sign-upload', { method: 'POST', body: { kind } },
    ),
    [authedRequest],
  );

  async function save() {
    setStatus('saving');
    try {
      await Promise.all([
        authedRequest('/api/creator/storefront', {
          method: 'PATCH',
          body: { theme, blocks: blocks.map((b) => ({ id: b.id, type: b.type, visible: b.visible !== false, config: b.config })) },
        }),
        authedRequest('/api/creator/profile', {
          method: 'PATCH',
          body: {
            displayName: form.displayName, category: form.category, bio: form.bio,
            avatarUrl: form.avatarUrl || '', ...(form.avatarPublicId ? { avatarPublicId: form.avatarPublicId } : {}),
            socialLinks: form.socialLinks.filter((l) => l.url.trim()),
          },
        }),
      ]);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1600);
    } catch { setStatus('error'); }
  }

  async function publish() {
    setPublishBusy(true); setPublishMsg('');
    try {
      // Persist current design first so the live page matches the editor.
      await save();
      await authedRequest('/api/creator/publish', { method: 'POST' });
      setPublished(true);
    } catch (err) {
      setPublishMsg(err instanceof ApiException ? err.message : 'Could not publish — verify your email first.');
    } finally { setPublishBusy(false); }
  }
  async function unpublish() {
    setPublishBusy(true); setPublishMsg('');
    try { await authedRequest('/api/creator/unpublish', { method: 'POST' }); setPublished(false); }
    catch (err) { setPublishMsg(err instanceof ApiException ? err.message : 'Could not unpublish'); }
    finally { setPublishBusy(false); }
  }

  /* ---- block ops ---- */
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  function snapshot() {
    // Capture current design so a destructive action can be undone.
    setUndoState({ theme, blocks });
  }
  function undo() {
    if (!undoState) return;
    setTheme(undoState.theme);
    setBlocks(undoState.blocks);
    setSelectedId(undoState.blocks[0]?.id ?? '');
    setUndoState(null);
    touch();
  }

  function doApplyTemplate(t: StoreTemplate) {
    snapshot();
    setTheme((p) => ({ ...p, ...t.theme, templateId: t.id } as BuilderTheme));
    const nb = t.build();
    setBlocks(nb);
    setSelectedId(nb[0]?.id ?? '');
    setCustomized(false); // freshly applied template is the new clean baseline
  }
  function applyTemplate(t: StoreTemplate) {
    // Only warn if there's customization to lose; otherwise swap instantly.
    if (customized) setConfirmTemplate(t);
    else doApplyTemplate(t);
  }
  function patchConfig(key: string, value: unknown) {
    setBlocks((bs) => bs.map((b) => (b.id === selectedId ? { ...b, config: { ...b.config, [key]: value } } : b)));
    touch();
  }
  function addBlock(type: BlockType) {
    const b = createBlock(type);
    setBlocks((bs) => [...bs, b]);
    setSelectedId(b.id);
    setAddOpen(false);
    touch();
  }
  function move(id: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 1 || j < 1 || j >= bs.length) return bs; // header (index 0) is pinned
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  }
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === fromId);
      const to = bs.findIndex((b) => b.id === toId);
      // Header is pinned at index 0 — never move it or drop anything above it.
      if (from < 1 || to < 1) return bs;
      const next = [...bs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    touch();
  }
  function duplicate(id: string) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const copy = createBlock(bs[i].type);
      copy.config = { ...bs[i].config };
      const next = [...bs];
      next.splice(i + 1, 0, copy);
      return next;
    });
    touch();
  }
  function remove(id: string) {
    snapshot();
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(blocks[0]?.id ?? '');
    touch();
  }
  function toggleVisible(id: string) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, visible: b.visible === false } : b)));
    touch();
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadToCloudinary(file, 'avatar', sign);
      setForm((f) => ({ ...f, avatarUrl: res.url, avatarPublicId: res.publicId }));
    } catch { /* paste URL fallback */ }
  }

  if (!ready || !profile) {
    return <div className="grid h-80 place-items-center text-sm text-neutral-400">Loading builder…</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Controls */}
      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={published ? 'success' : 'neutral'} dot>{published ? 'Published' : 'Draft'}</Badge>
            {undoState && <Button size="sm" variant="ghost" onClick={undo}>↩ Undo</Button>}
            {status === 'saved' && <span className="flex items-center gap-1 text-sm font-medium text-success-600"><IconCheck size={15} /> Saved</span>}
            {status === 'error' && <span className="text-sm text-danger-600">Save failed</span>}
          </div>
          <div className="flex items-center gap-2">
            {published ? (
              <>
                <Link href={`/${profile.username}`} target="_blank"><Button variant="secondary" size="sm"><IconExternal size={15} /> View live</Button></Link>
                <Button size="sm" variant="ghost" onClick={unpublish} loading={publishBusy}>Unpublish</Button>
                <Button size="sm" onClick={save} loading={status === 'saving'}>Save</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={save} loading={status === 'saving'}>Save draft</Button>
                <Button size="sm" onClick={publish} loading={publishBusy || status === 'saving'}>Save & Publish</Button>
              </>
            )}
          </div>
        </div>
        {!published && <Alert kind="info">Your store is a <strong>draft</strong> — it isn&apos;t live yet. Click <strong>Save &amp; Publish</strong> to make it visible at your store link.</Alert>}
        {publishMsg && <Alert kind="error">{publishMsg}</Alert>}

        {/* Theme & template */}
        <Card>
          <div className="text-sm font-semibold">Templates</div>
          <p className="mb-3 mt-0.5 text-xs text-neutral-500">Each template restyles your whole page — layout, colors, fonts and sections.</p>
          <div className="grid grid-cols-4 gap-2">
            {STORE_TEMPLATES.map((t) => {
              const active = theme.templateId === t.id;
              const lightText = !isDarkHex(t.theme.background);
              const a2 = t.theme.accent2 || t.theme.accent;
              const thumbBg = templateThumbBackground(t.theme.background, t.theme.accent, a2, t.theme.backgroundStyle);
              return (
                <button key={t.id} onClick={() => applyTemplate(t)}
                  className={cn('overflow-hidden rounded-lg border text-left transition hover:-translate-y-0.5',
                    active ? 'border-brand-400 ring-2 ring-brand-200' : 'border-line-strong')}>
                  {/* mini layout thumbnail so design differences are visible */}
                  <div className="space-y-1 p-1.5" style={{ background: thumbBg }}>
                    <div className="mx-auto h-3 w-3 rounded-full" style={{ background: `linear-gradient(135deg, ${t.theme.accent}, ${a2})` }} />
                    <div className="h-1 w-3/5 mx-auto rounded-full" style={{ background: lightText ? '#00000022' : '#ffffff33' }} />
                    <div className="mt-1 h-3 rounded" style={{ background: `linear-gradient(90deg, ${t.theme.accent}, ${a2})` }} />
                    <div className="h-2 rounded" style={{ background: lightText ? '#00000014' : '#ffffff1f' }} />
                  </div>
                  <div className="px-1.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: t.theme.background, color: lightText ? '#111' : '#fff' }}>{t.name}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <ColorField label="Background" value={theme.background ?? ''} onChange={(v) => { setTheme((t) => ({ ...t, background: v })); touch(); }} />
            <ColorField label="Accent" value={theme.accent ?? ''} onChange={(v) => { setTheme((t) => ({ ...t, accent: v })); touch(); }} />
            <ColorField label="Accent 2" value={theme.accent2 ?? ''} onChange={(v) => { setTheme((t) => ({ ...t, accent2: v })); touch(); }} />
            <Select label="Depth" value={theme.backgroundStyle ?? 'solid'} onChange={(e) => { setTheme((t) => ({ ...t, backgroundStyle: e.target.value as BuilderTheme['backgroundStyle'] })); touch(); }}>
              <option value="solid">Solid</option>
              <option value="gradient">Gradient</option>
              <option value="mesh">Mesh</option>
            </Select>
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">“Accent 2” drives two-tone banners and the mesh/gradient background.</p>
          <div className="mt-3">
            <Select label="Font" value={theme.fontPair ?? 'default'} onChange={(e) => { setTheme((t) => ({ ...t, fontPair: e.target.value })); touch(); }}>
              {FONT_PAIRS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
        </Card>

        {/* Blocks list */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Sections</div>
            <div className="relative">
              <Button size="sm" variant="secondary" onClick={() => setAddOpen((o) => !o)}><IconPlus size={15} /> Add</Button>
              {addOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 shadow-lift">
                  {(['offers', 'content'] as const).map((cat) => (
                    <div key={cat} className="px-1 py-1">
                      <div className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wide text-neutral-400">{cat}</div>
                      {ADDABLE_BLOCKS.filter((t) => BLOCK_DEFS[t].category === cat).map((t) => (
                        <button key={t} onClick={() => addBlock(t)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-muted">
                          <span>{BLOCK_DEFS[t].emoji}</span> {BLOCK_DEFS[t].label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Drag to reorder — your profile header stays pinned at the top.</p>
          <div className="mt-3 space-y-1.5">
            {blocks.map((b, i) => {
              const pinned = BLOCK_DEFS[b.type].pinned;
              return (
                <div key={b.id}
                  draggable={!pinned}
                  onDragStart={(e) => { if (pinned) return; setDraggingId(b.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { if (!draggingId || pinned) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => { if (pinned) return; e.preventDefault(); reorder(draggingId, b.id); setDraggingId(''); }}
                  onDragEnd={() => setDraggingId('')}
                  onClick={() => setSelectedId(b.id)}
                  className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition',
                    selectedId === b.id ? 'border-brand-400 bg-brand-50' : 'border-line hover:bg-surface-muted',
                    draggingId === b.id && 'opacity-40',
                    b.visible === false && 'opacity-55')}>
                  {pinned
                    ? <span className="w-3.5 text-center text-neutral-300">·</span>
                    : <span className="cursor-grab text-neutral-300 hover:text-neutral-500" title="Drag to reorder">⠿</span>}
                  <span>{BLOCK_DEFS[b.type].emoji}</span>
                  <span className="flex-1 truncate font-medium">{b.config?.title || BLOCK_DEFS[b.type].label}{pinned && <span className="ml-1 text-2xs text-neutral-400">· pinned</span>}</span>
                  {!pinned && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} disabled={i <= 1} className="px-1 text-neutral-400 hover:text-ink disabled:opacity-30">▲</button>
                      <button onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} disabled={i === blocks.length - 1} className="px-1 text-neutral-400 hover:text-ink disabled:opacity-30">▼</button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); toggleVisible(b.id); }} title="Show/hide" className="px-1 text-neutral-400 hover:text-ink">{b.visible === false ? '🙈' : '👁'}</button>
                  {!pinned && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); duplicate(b.id); }} title="Duplicate" className="px-1 text-neutral-400 hover:text-ink"><IconCopy size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); remove(b.id); }} title="Delete" className="px-1 text-neutral-400 hover:text-danger-600"><IconTrash size={13} /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Selected block settings */}
        {selected && (
          <div ref={settingsRef}>
          <Card>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{BLOCK_DEFS[selected.type].emoji}</span> Edit {BLOCK_DEFS[selected.type].label}
            </div>

            {selected.type === 'header' && (
              <div className="mt-4 space-y-4 border-b border-line pb-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Profile content</div>
                <div className="flex items-center gap-3">
                  <Avatar src={form.avatarUrl} name={form.displayName} size={48} />
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-white px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-surface-muted">
                    <IconImage size={15} /> Upload<input type="file" accept="image/*" onChange={onAvatar} className="hidden" />
                  </label>
                </div>
                <Field label="Display name" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
                <Field label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                <Textarea label="Bio" rows={2} maxLength={500} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-neutral-800">Social links</span>
                  <div className="space-y-2">
                    {form.socialLinks.map((l, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select value={l.platform} onChange={(e) => setForm((f) => ({ ...f, socialLinks: f.socialLinks.map((x, j) => j === idx ? { ...x, platform: e.target.value } : x) }))} className="h-9 rounded-lg border border-line-strong bg-white px-2 text-sm capitalize">
                          {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input value={l.url} onChange={(e) => setForm((f) => ({ ...f, socialLinks: f.socialLinks.map((x, j) => j === idx ? { ...x, url: e.target.value } : x) }))} placeholder="https://…" className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm" />
                        <button onClick={() => setForm((f) => ({ ...f, socialLinks: f.socialLinks.filter((_, j) => j !== idx) }))} className="rounded-lg p-1.5 text-neutral-400 hover:text-danger-600"><IconX size={15} /></button>
                      </div>
                    ))}
                    {form.socialLinks.length < 10 && (
                      <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, socialLinks: [...f.socialLinks, { platform: 'instagram', url: '' }] }))}><IconPlus size={14} /> Add link</Button>
                    )}
                  </div>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Appearance</div>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {BLOCK_DEFS[selected.type].fields.map((f) => (
                <FieldControl key={f.key} spec={f} value={selected.config[f.key]} onChange={(v) => patchConfig(f.key, v)} />
              ))}
            </div>
          </Card>
          </div>
        )}
      </div>

      {/* Live preview */}
      <div>
        <div className="lg:sticky lg:top-6">
          <PhoneFrame>
            <StoreCanvas
              mode="preview"
              profile={{ ...profile, ...form }}
              theme={theme}
              blocks={blocks}
              products={[...items.products, ...items.leads]}
              courses={items.courses}
              bookingTypes={items.bookingTypes}
              selectedId={selectedId}
              onSelectBlock={setSelectedId}
            />
          </PhoneFrame>
        </div>
      </div>

      {/* Confirm before a template swap discards customizations */}
      {confirmTemplate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmTemplate(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">Apply “{confirmTemplate.name}”?</div>
            <p className="mt-1.5 text-sm text-neutral-500">This replaces your current layout, colors and fonts. Your profile details, products and links are kept. You can undo right after.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmTemplate(null)}>Cancel</Button>
              <Button size="sm" onClick={() => { const t = confirmTemplate; setConfirmTemplate(null); doApplyTemplate(t); }}>Replace design</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- generic field control ---------------- */
function FieldControl({ spec, value, onChange }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
