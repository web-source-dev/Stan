'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { IconLink, IconPencil, IconPlay } from '@/components/icons';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { cn } from '@/lib/cn';
import {
  buildInitialLinkMedia,
  buildLinkMediaBody,
  type LinkMediaEditorState,
  type LinkMediaStyle,
} from '@/lib/link-media-types';

export type { LinkMediaEditorState } from '@/lib/link-media-types';

function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="pe-step-badge">{n}</span>
      <span className="pe-step-label">{label}</span>
    </div>
  );
}

function CharField({
  label,
  required,
  value,
  onChange,
  max,
  placeholder,
  multiline,
  rows = 2,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="pe-field-label">
          {label}
          {required && <span className="pe-field-req">*</span>}
        </label>
        <span className="text-[11px] text-[#a1a1aa]">
          {value.length}/{max}
        </span>
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          rows={rows}
          placeholder={placeholder}
          className="pe-input-outline resize-y min-h-[72px]"
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} className="pe-input-outline" />
      )}
    </div>
  );
}

function IconSaveGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h7V3M8 21v-6h8v6" />
    </svg>
  );
}

function IconFolderGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 7.2A1.7 1.7 0 0 1 4.7 5.5h3.9a1.7 1.7 0 0 1 1.2.5l1.1 1.1h7.4A1.7 1.7 0 0 1 21 8.8v1.2H3z" fill="#f4a259" />
      <path d="M3 9.2h18a1.5 1.5 0 0 1 1.48 1.77l-1.1 6A1.5 1.5 0 0 1 19.9 18.2H4.1a1.5 1.5 0 0 1-1.48-1.23l-1.1-6A1.5 1.5 0 0 1 3 9.2z" fill="#f7b977" />
    </svg>
  );
}

const STYLE_CONFIG: Record<
  LinkMediaStyle,
  { label: string; icon: React.ReactNode; isNew?: boolean }
> = {
  button: {
    label: 'Button',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  callout: {
    label: 'Callout',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="5" width="18" height="11" rx="2" />
        <path d="M9 20h6M12 16v4" />
      </svg>
    ),
  },
  embed: {
    label: 'Embed',
    isNew: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M10.5 9.2 15 12l-4.5 2.8z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
};

function LinkMediaPreviewCard({ form }: { form: LinkMediaEditorState }) {
  const btnLabel = form.thumbnailButtonLabel || 'Visit Link';
  const price = '';

  if (form.thumbnailStyle === 'button') {
    return (
      <div className="pe-preview-card pe-preview-card--button">
        <div className="text-[13px] font-bold text-[#1a1a2e]">{form.title || 'Product title'}</div>
        <button type="button" className="pe-preview-cta mt-3">{btnLabel}</button>
      </div>
    );
  }

  return (
    <div className="pe-preview-card">
      <div className="flex gap-3">
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover" />
        ) : (
          <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] bg-[#eaf0ff]">
            <IconFolderGlyph size={28} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Product title'}</div>
          {form.shortDescription && <p className="mt-0.5 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>}
          {price && <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>}
        </div>
      </div>
      <button type="button" className="pe-preview-cta">{btnLabel}</button>
    </div>
  );
}

function EmbedPhonePreview() {
  return (
    <div className="flex min-h-full flex-col bg-white px-4 pb-8 pt-4">
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#f3f0ff] px-6 py-16 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#e8e4ff] text-[#6355fa]">
          <IconPlay size={26} />
        </div>
        <p className="text-sm font-medium leading-relaxed text-[#6355fa]">Your media content will be displayed here</p>
      </div>
    </div>
  );
}

export function LinkMediaEditor({
  initial = buildInitialLinkMedia(),
  onSaved,
}: {
  initial?: LinkMediaEditorState;
  onSaved: (id: string) => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<LinkMediaEditorState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [uploadNote, setUploadNote] = useState('');

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const { open: openMediaLibrary } = useMediaLibrary();

  const patch = useCallback(<K extends keyof LinkMediaEditorState>(key: K, value: LinkMediaEditorState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  function pickCover() {
    openMediaLibrary({
      accept: 'image',
      kind: 'product_cover',
      title: 'Select an image',
      onSelect: (m) => {
        setForm((f) => ({ ...f, coverImageUrl: m.url, coverPublicId: m.publicId }));
        setUploadNote('');
      },
    });
  }

  async function save(publish: boolean) {
    setBusy(true);
    setError('');
    if (publish && !form.redirectUrl.trim()) {
      setError(form.thumbnailStyle === 'embed' ? 'Add an embed URL before publishing' : 'Add a link URL before publishing');
      setBusy(false);
      return;
    }
    try {
      const body = buildLinkMediaBody(form);
      let id = form.id;
      if (id) {
        await authedRequest(`/api/products/${id}`, { method: 'PATCH', body });
      } else {
        const res = await authedRequest<{ product: { id: string } }>('/api/products', { method: 'POST', body });
        id = res.product.id;
        setForm((f) => ({ ...f, id }));
      }
      if (publish && id) {
        await authedRequest(`/api/products/${id}/publish`, { method: 'POST' });
        onSaved(id);
      } else {
        setSavedNote('Draft saved');
        setTimeout(() => setSavedNote(''), 2500);
      }
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const isEmbed = form.thumbnailStyle === 'embed';
  const urlLabel = isEmbed ? 'Paste embed URL' : 'Paste link URL';
  const urlPlaceholder = isEmbed ? 'http://your-embed-link' : 'https://your-link.com';
  const urlHint = isEmbed ? 'Works with embed links from YouTube and Spotify' : 'Affiliate links, websites, or any URL you want to share';

  return (
    <div className="product-editor">
      <div className="pe-layout">
        <div className="pe-main min-w-0">
          {error && <Alert kind="error" className="mb-4">{error}</Alert>}
          {savedNote && <Alert kind="success" className="mb-4">{savedNote}</Alert>}
          {uploadNote && <Alert kind="info" className="mb-4">{uploadNote}</Alert>}

          <section className="pe-section">
            <Step n={1} label="Pick a style" />
            <div className="pe-section-inner flex flex-wrap gap-3">
              {(['button', 'callout', 'embed'] as const).map((style) => {
                const cfg = STYLE_CONFIG[style];
                const sel = form.thumbnailStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => patch('thumbnailStyle', style)}
                    className={cn('pe-style-card relative', sel && 'pe-style-card--active')}
                  >
                    {cfg.isNew && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-[#6355fa] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        New
                      </span>
                    )}
                    <div className="pe-style-card-icon">{cfg.icon}</div>
                    <div className="pe-style-card-label">{cfg.label}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {!isEmbed && (
            <>
              <section className="pe-section">
                <Step n={2} label="Select image" />
                <div className="pe-section-inner pe-upload-row">
                  <div className="relative shrink-0">
                    {form.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.coverImageUrl} alt="" className="h-[72px] w-[72px] rounded-[10px] object-cover" />
                    ) : (
                      <div className="grid h-[72px] w-[72px] place-items-center rounded-[10px] bg-[#eaf0ff]">
                        <IconLink size={30} className="text-[#3d63ff]" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={pickCover}
                      aria-label="Choose image"
                      className="absolute -right-1.5 -top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[#6355fa] text-white shadow-md"
                    >
                      <IconPencil size={12} />
                    </button>
                  </div>
                  <div className="flex min-w-[140px] flex-1 flex-col items-center justify-center py-1 text-center">
                    <p className="text-sm font-medium text-[#3d3d4a]">Thumbnail 400x400</p>
                  </div>
                  <button type="button" onClick={pickCover} className="pe-btn-outline shrink-0 cursor-pointer">
                    Choose Image
                  </button>
                </div>
              </section>

              <section className="pe-section">
                <Step n={3} label="Add text" />
                <div className="pe-section-inner space-y-4">
                  <CharField label="Title" value={form.title} onChange={(v) => patch('title', v)} max={50} />
                  <CharField label="Subtitle" value={form.shortDescription} onChange={(v) => patch('shortDescription', v)} max={100} multiline />
                  <CharField label="Button" required value={form.thumbnailButtonLabel} onChange={(v) => patch('thumbnailButtonLabel', v)} max={30} />
                </div>
              </section>
            </>
          )}

          <section className="pe-section">
            <Step n={isEmbed ? 2 : 4} label={urlLabel} />
            <div className="pe-section-inner">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                  <IconLink size={18} />
                </span>
                <input
                  value={form.redirectUrl}
                  onChange={(e) => patch('redirectUrl', e.target.value.slice(0, 1024))}
                  placeholder={urlPlaceholder}
                  className="w-full rounded-lg border border-[#e4e5eb] bg-white py-3 pl-10 pr-16 text-sm text-[#1a1a2e] outline-none focus:border-[#6355fa] focus:ring-2 focus:ring-[#6355fa]/15"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#a1a1aa]">
                  {form.redirectUrl.length}/1024
                </span>
              </div>
              <p className="mt-2 text-xs text-[#8b8d98]">{urlHint}</p>
            </div>
          </section>

          <div className="mt-12 border-t border-[#e4e5eb] pt-6">
            <p className="pe-footer-note">Improve this page</p>
            <div className="pe-footer-actions">
              <button type="button" disabled={busy} onClick={() => void save(false)} className="pe-btn-outline disabled:opacity-50">
                <IconSaveGlyph /> Save As Draft
              </button>
              <button type="button" disabled={busy} onClick={() => void save(true)} className="pe-btn-solid disabled:opacity-50">
                Publish
              </button>
            </div>
          </div>
        </div>

        <div className="pe-preview-col">
          {isEmbed ? (
            <div className="pe-phone-wrap">
              <PhoneFrame>
                <EmbedPhonePreview />
              </PhoneFrame>
            </div>
          ) : (
            <div className="pe-preview-thumb">
              <LinkMediaPreviewCard form={form} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
