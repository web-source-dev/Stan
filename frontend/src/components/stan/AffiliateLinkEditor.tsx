'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import {
  buildAffiliateLinkBody,
  buildInitialAffiliateLink,
  buildStanAffiliateUrl,
  type AffiliateLinkEditorState,
  type AffiliateLinkStyle,
} from '@/lib/affiliate-link-types';
import { IconDollar, IconPencil } from '@/components/icons';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { cn } from '@/lib/cn';

export type { AffiliateLinkEditorState } from '@/lib/affiliate-link-types';

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
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          placeholder={placeholder}
          className="pe-input-outline"
        />
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

function DefaultAffiliateThumb({ size = 52 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[10px] bg-[#3d63ff] text-white"
      style={{ width: size, height: size }}
    >
      <IconDollar size={Math.round(size * 0.46)} />
    </div>
  );
}

const STYLE_CONFIG: Record<AffiliateLinkStyle, { label: string; icon: React.ReactNode }> = {
  button: {
    label: 'Button',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="9" width="18" height="6" rx="3" />
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
};

function AffiliateLinkPreviewCard({ form }: { form: AffiliateLinkEditorState }) {
  const btnLabel = form.thumbnailButtonLabel || 'Click Me!';

  if (form.thumbnailStyle === 'button') {
    return (
      <div className="pe-preview-card pe-preview-card--button">
        <div className="text-[13px] font-bold text-[#1a1a2e]">{form.title || 'Build your Stan Store'}</div>
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
          <DefaultAffiliateThumb size={52} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Build your Stan Store'}</div>
          {form.shortDescription && (
            <p className="mt-0.5 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>
          )}
        </div>
      </div>
      <button type="button" className="pe-preview-cta">{btnLabel}</button>
    </div>
  );
}

export function AffiliateLinkEditor({
  initial,
  onSaved,
}: {
  initial?: AffiliateLinkEditorState;
  onSaved: (id: string) => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<AffiliateLinkEditorState>(initial ?? buildInitialAffiliateLink());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(!initial?.affiliateUrl);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    async function loadAffiliateUrl() {
      try {
        const res = await authedRequest<{ profile: { username: string } | null }>('/api/creator/profile');
        const url = buildStanAffiliateUrl(res.profile?.username ?? '');
        if (!cancelled && url) {
          setForm((f) => ({ ...f, affiliateUrl: f.affiliateUrl || url }));
        }
      } catch {
        // keep existing URL if profile fetch fails
      } finally {
        if (!cancelled) setLoadingUrl(false);
      }
    }
    void loadAffiliateUrl();
    return () => {
      cancelled = true;
    };
  }, [authedRequest]);

  const { open: openMediaLibrary } = useMediaLibrary();

  const patch = useCallback(<K extends keyof AffiliateLinkEditorState>(key: K, value: AffiliateLinkEditorState[K]) => {
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

    let affiliateUrl = form.affiliateUrl.trim();
    try {
      const res = await authedRequest<{ profile: { username: string } | null }>('/api/creator/profile');
      const fresh = buildStanAffiliateUrl(res.profile?.username ?? '');
      if (fresh) affiliateUrl = fresh;
    } catch {
      // use existing affiliateUrl
    }

    if (publish && !affiliateUrl) {
      setError('Complete onboarding with a store username before publishing your affiliate link');
      setBusy(false);
      return;
    }

    try {
      const body = buildAffiliateLinkBody({ ...form, affiliateUrl });
      let id = form.id;
      if (id) {
        await authedRequest(`/api/products/${id}`, { method: 'PATCH', body });
      } else {
        const res = await authedRequest<{ product: { id: string } }>('/api/products', { method: 'POST', body });
        id = res.product.id;
      }
      setForm((f) => ({ ...f, id, affiliateUrl }));
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
              {(['button', 'callout'] as const).map((style) => {
                const cfg = STYLE_CONFIG[style];
                const sel = form.thumbnailStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => patch('thumbnailStyle', style)}
                    className={cn('pe-style-card', sel && 'pe-style-card--active')}
                  >
                    <div className="pe-style-card-icon">{cfg.icon}</div>
                    <div className="pe-style-card-label">{cfg.label}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {form.thumbnailStyle === 'callout' && (
            <section className="pe-section">
              <Step n={2} label="Select image" />
              <div className="pe-section-inner pe-upload-row">
                <div className="relative shrink-0">
                  {form.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImageUrl} alt="" className="h-[72px] w-[72px] rounded-[10px] object-cover" />
                  ) : (
                    <DefaultAffiliateThumb size={72} />
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
          )}

          <section className="pe-section">
            <Step n={form.thumbnailStyle === 'callout' ? 3 : 2} label="Add text" />
            <div className="pe-section-inner space-y-4">
              <CharField label="Title" value={form.title} onChange={(v) => patch('title', v)} max={50} />
              {form.thumbnailStyle === 'callout' && (
                <CharField
                  label="Subtitle"
                  value={form.shortDescription}
                  onChange={(v) => patch('shortDescription', v)}
                  max={100}
                  multiline
                  placeholder="Enter a description for your followers here"
                />
              )}
              <CharField label="Button" required value={form.thumbnailButtonLabel} onChange={(v) => patch('thumbnailButtonLabel', v)} max={30} />
              <div>
                <label className="mb-1.5 block pe-field-label">Button URL</label>
                <input
                  readOnly
                  value={loadingUrl ? 'Loading your affiliate link…' : form.affiliateUrl}
                  className="pe-input-outline cursor-default bg-[#f3f4f6] text-[#6b7280]"
                />
                <p className="mt-2 text-xs text-[#8b8d98]">
                  Refer a friend and receive 20% of their Stan Subscription fee each month!
                </p>
              </div>
            </div>
          </section>

          <div className="mt-12 border-t border-[#e4e5eb] pt-6">
            <p className="pe-footer-note">Improve this page</p>
            <div className="pe-footer-actions">
              <button type="button" disabled={busy} onClick={() => void save(false)} className="pe-btn-outline disabled:opacity-50">
                <IconSaveGlyph /> Save As Draft
              </button>
              <button type="button" disabled={busy || loadingUrl} onClick={() => void save(true)} className="pe-btn-solid disabled:opacity-50">
                Publish
              </button>
            </div>
          </div>
        </div>

        <div className="pe-preview-col">
          <div className="pe-preview-thumb">
            <AffiliateLinkPreviewCard form={form} />
          </div>
        </div>
      </div>
    </div>
  );
}
