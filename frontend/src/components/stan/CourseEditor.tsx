'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import {
  IconArrowLeft,
  IconBook,
  IconChevronDown,
  IconImage,
  IconLock,
  IconMail,
  IconPencil,
  IconSmile,
  IconUsers,
} from '@/components/icons';
import { uploadAndRecord, type SignKind } from '@/lib/upload';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { cn } from '@/lib/cn';
import { EditorTopBar } from '@/components/stan/EditorTopBar';
import {
  generateCourseDescription,
  type CourseEditorState,
  type CourseModule,
  type CourseModuleLesson,
} from '@/lib/course-types';
import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  type ProductCustomField,
  type ProductEmailFlowStep,
} from '@/lib/product-options';

export type { CourseEditorState } from '@/lib/course-types';

type EditorTab = 'thumbnail' | 'checkout' | 'course' | 'options';

type ReviewRow = { id: string; author: string; quote: string; rating: number };
type OrderBumpState = { enabled: boolean; title: string; description: string; priceDollars: string };
type AffiliateState = { enabled: boolean; commissionPercent: number };

type LocalOptionState = {
  reviewsEnabled: boolean;
  reviews: ReviewRow[];
  orderBump: OrderBumpState;
  affiliate: AffiliateState;
};

const EMPTY_OPTION_STATE: LocalOptionState = {
  reviewsEnabled: false,
  reviews: [],
  orderBump: {
    enabled: false,
    title: '',
    description: '',
    priceDollars: '0.00',
  },
  affiliate: {
    enabled: false,
    commissionPercent: 20,
  },
};

const STYLE_ICON: Record<CourseEditorState['thumbnailStyle'], React.ReactNode> = {
  button: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="3" />
    </svg>
  ),
  callout: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  ),
  preview: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M10.5 9.2 15 12l-4.5 2.8z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const STYLE_LABELS: Record<CourseEditorState['thumbnailStyle'], string> = {
  button: 'Button',
  callout: 'Callout',
  preview: 'Preview',
};

function uid() {
  return `_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  return { next, cursor: start + before.length + selected.length + after.length };
}

function formatUsPrice(dollars: number) {
  return `US$${dollars.toFixed(2)}`;
}

function renderDescriptionLine(line: string, key: number) {
  const bullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');
  const text = line.replace(/^[\s•\-]+/, '').trim();
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const content =
    parts.length > 1
      ? parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={i} className="font-bold text-[#1a1a2e]">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          ),
        )
      : text;

  if (bullet) {
    return (
      <p key={key} className="flex gap-2 pl-0.5">
        <span className="shrink-0 font-bold text-[#6355fa]">•</span>
        <span>{content}</span>
      </p>
    );
  }
  return <p key={key}>{content}</p>;
}

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
  rows = 3,
  variant = 'filled',
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  variant?: 'filled' | 'outline';
}) {
  const fieldClass = variant === 'outline' ? 'pe-input-outline' : multiline ? 'pe-textarea resize-y min-h-[88px]' : 'pe-input';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="pe-field-label">
          {label}
          {required && <span className="pe-field-req">*</span>}
        </label>
        <span className="pe-char-count">
          {value.length}/{max}
        </span>
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          maxLength={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={variant === 'outline' ? 'pe-input-outline resize-y min-h-[88px]' : 'pe-textarea resize-y min-h-[88px]'}
        />
      ) : (
        <input
          maxLength={max}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn('pe-toggle-track', on ? 'pe-toggle-track--on' : 'pe-toggle-track--off')}
    >
      <span className="pe-toggle-thumb" />
    </button>
  );
}

function DescToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button type="button" title={title} onClick={onClick} className="pe-toolbar-btn">
      {children}
    </button>
  );
}

function IconGradCapGlyph({ size = 22 }: { size?: number }) {
  return (
    <div className="grid place-items-center rounded-[12px] bg-[#e9efff]" style={{ width: size + 22, height: size + 22 }}>
      <IconBook size={size} className="text-[#3d63ff]" />
    </div>
  );
}

function IconCartGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
      <path d="M2.5 3.5h2.2l2.1 10.4a1.4 1.4 0 0 0 1.4 1.1h8a1.4 1.4 0 0 0 1.4-1.1L20.5 7H6" />
    </svg>
  );
}

function IconGradCapTabGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8.2 12 3l10 5.2-10 5.2z" />
      <path d="M6.5 10.5V15c0 1.6 2.4 3 5.5 3s5.5-1.4 5.5-3v-4.5" />
      <path d="M22 8.2v5.3" />
    </svg>
  );
}

function IconSlidersGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h7M15 8h5M4 16h5M13 16h7" />
      <circle cx="13" cy="8" r="2" />
      <circle cx="11" cy="16" r="2" />
    </svg>
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

function CheckoutHeroPlaceholder() {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e8ecf4] via-[#dfe4ee] to-[#d4dae8]">
      <svg width="88" height="56" viewBox="0 0 88 56" fill="none" aria-hidden>
        <rect x="8" y="6" width="72" height="44" rx="4" fill="#c5cdd9" />
        <rect x="12" y="10" width="64" height="36" rx="2" fill="#eef1f6" />
        <rect x="0" y="48" width="88" height="6" rx="2" fill="#b8c0cc" />
      </svg>
    </div>
  );
}

function ThumbnailPreviewCard({ form }: { form: CourseEditorState }) {
  const price = `$${form.priceDollars || '9.99'}`;
  const btnLabel = form.thumbnailButtonLabel || form.bottomTitle || form.ctaLabel || 'GET MY COURSE';

  if (form.thumbnailStyle === 'button') {
    return (
      <div className="pe-preview-card pe-preview-card--button">
        <div className="text-[13px] font-bold text-[#1a1a2e]">{form.title || 'Get started with this amazing course'}</div>
        <button type="button" className="pe-preview-cta mt-3">
          {btnLabel}
        </button>
      </div>
    );
  }

  if (form.thumbnailStyle === 'preview') {
    return (
      <div className="pe-preview-card pe-preview-card--preview">
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="pe-preview-hero" />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8]">
            <IconGradCapGlyph size={30} />
          </div>
        )}
        <div className="pe-preview-body">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Get started with this amazing course'}</div>
          {form.shortDescription && <p className="mt-1 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
          <button type="button" className="pe-preview-cta mt-3">
            {btnLabel}
          </button>
        </div>
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
            <IconBook size={24} className="text-[#3d63ff]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Get started with this amazing course'}</div>
          {form.shortDescription && <p className="mt-0.5 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
        </div>
      </div>
      <button type="button" className="pe-preview-cta">
        {btnLabel}
      </button>
    </div>
  );
}

function CheckoutPreview({
  form,
  showHeroBack,
  showTotal = true,
  showFormFields = true,
  showPurchaseCta = true,
  bottomTitleAsFooter = false,
  ctaDark = false,
}: {
  form: CourseEditorState;
  showHeroBack?: boolean;
  showTotal?: boolean;
  showFormFields?: boolean;
  showPurchaseCta?: boolean;
  bottomTitleAsFooter?: boolean;
  ctaDark?: boolean;
}) {
  const cents =
    form.discountEnabled && form.discountPriceDollars
      ? Math.round(parseFloat(form.discountPriceDollars || '0') * 100)
      : Math.round(parseFloat(form.priceDollars || '0') * 100);
  const priceLabel = `$${(cents / 100).toFixed(2)}`;
  const lines = (form.description || '').split('\n').filter(Boolean);

  return (
    <div className="min-h-full bg-white px-3.5 pb-8 pt-2">
      <div className="relative mb-3.5">
        {showHeroBack && (
          <button
            type="button"
            aria-label="Back"
            className="absolute left-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#1a1a2e] shadow-sm"
          >
            <IconArrowLeft size={16} />
          </button>
        )}
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="w-full rounded-xl object-cover" style={{ aspectRatio: '16/10' }} />
        ) : (
          <CheckoutHeroPlaceholder />
        )}
      </div>
      <h1 className="text-[16px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Get started with this amazing course'}</h1>
      <p className="mt-0.5 text-[15px] font-bold text-[#6355fa]">
        {priceLabel}
        {form.billingInterval === 'month' && <span className="text-xs font-semibold text-[#8b8d98]"> / month</span>}
        {form.billingInterval === 'year' && <span className="text-xs font-semibold text-[#8b8d98]"> / year</span>}
      </p>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[#4b5563]">
          {lines.map((line, i) => renderDescriptionLine(line, i))}
        </div>
      )}
      {form.bottomTitle && !bottomTitleAsFooter && <h2 className="mt-5 text-center text-[15px] font-bold text-[#1a1a2e]">{form.bottomTitle}</h2>}
      {showFormFields && (
        <div className="mt-4 space-y-2.5">
          <input readOnly placeholder="Enter your name" className="pe-preview-field" />
          <input readOnly placeholder="Enter your email" className="pe-preview-field" />
          {form.customFields.map((f) => (
            <input key={f.id} readOnly placeholder={f.label} className="pe-preview-field" />
          ))}
        </div>
      )}
      {showTotal && (
        <div className="pe-preview-total mt-4">
          <span className="font-semibold text-[#1a1a2e]">Total :</span>
          <span className="pe-preview-total-dots" aria-hidden />
          <span className="font-bold text-[#6355fa]">{formatUsPrice(cents / 100)}</span>
        </div>
      )}
      {bottomTitleAsFooter && (
        <p className="mt-6 text-center text-[15px] font-bold text-[#1a1a2e]">
          {form.bottomTitle || 'Get My Course'}
        </p>
      )}
      {showPurchaseCta && (
        <button
          type="button"
          className={cn('pe-preview-cta mt-4 uppercase tracking-wide', ctaDark && '!bg-[#111111] !text-white')}
        >
          {form.ctaLabel || 'PURCHASE'}
        </button>
      )}
    </div>
  );
}

function CourseHomepagePreview({ form }: { form: CourseEditorState }) {
  const lines = (form.homepageDescription || '').split('\n').filter(Boolean);
  return (
    <div className="min-h-full" style={{ backgroundColor: form.backgroundColor || '#f3f6fd' }}>
      <div className="border-b border-black/5 bg-white/70 px-3 py-2.5 backdrop-blur">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-black/20" />
      </div>
      <div className="px-4 pb-7 pt-3.5">
        <div className="overflow-hidden rounded-[14px] bg-white shadow-[0_10px_24px_-12px_rgba(15,15,25,0.24)]">
          {form.homepageCoverImageUrl || form.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.homepageCoverImageUrl || form.coverImageUrl}
              alt=""
              className="h-[130px] w-full object-cover"
            />
          ) : (
            <div className="grid h-[130px] place-items-center bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8]">
              <IconBook size={34} className="text-[#4b5fff]" />
            </div>
          )}
          <div className="p-3.5">
            <h2
              className="text-[16px] font-bold leading-snug"
              style={{ color: form.highlightColor || '#6355FF', fontFamily: form.titleFont || 'inherit' }}
            >
              {form.homepageTitle || form.title || 'My 12-week Program'}
            </h2>
            <div className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#4b5563]">
              {lines.slice(0, 4).map((line, i) => renderDescriptionLine(line, i))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-black/5 bg-white px-4 py-3 text-[#1a1a2e]">
        <span className="text-lg leading-none">☰</span>
        <span className="truncate text-xs font-semibold">{form.homepageTitle || form.title || 'Homepage'}</span>
        <span className="grid h-5 w-5 place-items-center rounded-full border border-[#d4d7e3] text-[10px]">•</span>
      </div>
    </div>
  );
}

function CollectInfoFields({
  form,
  setForm,
  step,
}: {
  form: CourseEditorState;
  setForm: React.Dispatch<React.SetStateAction<CourseEditorState>>;
  step: number;
}) {
  return (
    <section className="pe-section">
      <Step n={step} label="Collect info" />
      <div className="pe-section-inner">
        <p className="mb-1 pe-field-label">Fields</p>
        <p className="mb-3 text-xs text-[#8b8d98]">Basic info fields can&apos;t be edited</p>
        <div className="space-y-2.5">
          {(['Name', 'Email'] as const).map((f) => (
            <div key={f} className="pe-readonly-field">
              <span className="text-[#a1a1aa]">{f === 'Name' ? '👤' : <IconMail size={16} />}</span>
              {f}
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-[#e4e5eb] pt-4">
          <p className="pe-link-muted">Collect additional customer info</p>
          <div className="mt-2 space-y-2">
            {form.customFields.map((field) => (
              <div key={field.id} className="pe-custom-row">
                <input
                  value={field.label}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customFields: f.customFields.map((x) => (x.id === field.id ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                  placeholder="Field label"
                  className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customFields: f.customFields.map((x) =>
                        x.id === field.id ? { ...x, type: e.target.value as ProductCustomField['type'] } : x,
                      ),
                    }))
                  }
                  className="rounded-lg border border-[#e4e5eb] px-2 py-1 text-xs"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="phone">Phone</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customFields: f.customFields.map((x) => (x.id === field.id ? { ...x, required: e.target.checked } : x)),
                      }))
                    }
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      customFields: f.customFields.filter((x) => x.id !== field.id),
                    }))
                  }
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                customFields: [...f.customFields, { id: uid(), label: 'Custom field', type: 'text', required: false }],
              }))
            }
            className="pe-btn-outline mt-2"
          >
            + Add Field
          </button>
        </div>
      </div>
    </section>
  );
}

function AccordionPanel({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="pe-accordion">
      <button type="button" onClick={onToggle} className="pe-accordion-head">
        <span className="pe-accordion-icon">{icon}</span>
        <span className="pe-accordion-title">{title}</span>
        <IconChevronDown size={18} className={cn('text-[#a1a1aa] transition', !open && 'rotate-180')} />
      </button>
      {open && children && <div className="border-t border-[#e4e5eb] px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

export function CourseEditor({
  initial,
  onSaved,
}: {
  initial: CourseEditorState;
  onSaved: (id: string) => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<CourseEditorState>(initial);
  const [tab, setTab] = useState<EditorTab>('thumbnail');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [descRef, setDescRef] = useState<HTMLTextAreaElement | null>(null);
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [priceProUnlocked, setPriceProUnlocked] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localOptions, setLocalOptions] = useState<LocalOptionState>(EMPTY_OPTION_STATE);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const sign = useCallback(
    (kind: SignKind) =>
      authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        '/api/cloudinary/sign-upload',
        { method: 'POST', body: { kind } },
      ),
    [authedRequest],
  );

  const patch = useCallback(<K extends keyof CourseEditorState>(key: K, value: CourseEditorState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const loadCourseTree = useCallback(async () => {
    if (!form.id) return;
    try {
      const res = await authedRequest<{ course: Partial<CourseEditorState>; modules: CourseModule[] }>(`/api/courses/${form.id}`);
      setForm((f) => ({ ...f, modules: res.modules ?? f.modules }));
    } catch {
      // keep working with current local modules
    }
  }, [authedRequest, form.id]);

  useEffect(() => {
    void loadCourseTree();
  }, [loadCourseTree]);

  async function ensureCourseId(): Promise<string> {
    if (form.id) return form.id;
    const res = await authedRequest<{ course: { id: string } }>('/api/courses', {
      method: 'POST',
      body: buildBody(form),
    });
    const nextId = res.course.id;
    setForm((f) => ({ ...f, id: nextId }));
    return nextId;
  }

  const { open: openMediaLibrary } = useMediaLibrary();

  function pickCover() {
    openMediaLibrary({
      accept: 'image',
      kind: 'course_cover',
      title: 'Select an image',
      onSelect: (m) => {
        setForm((f) => ({ ...f, coverImageUrl: m.url, coverPublicId: m.publicId }));
        setUploadNote('');
      },
    });
  }

  function pickHomepageCover() {
    openMediaLibrary({
      accept: 'image',
      kind: 'course_cover',
      title: 'Select a homepage cover',
      onSelect: (m) => {
        setForm((f) => ({ ...f, homepageCoverImageUrl: m.url, homepageCoverPublicId: m.publicId }));
        setUploadNote('');
      },
    });
  }

  // Direct upload kept for drag-and-drop; also records into the media library.
  async function handleCoverFile(file: File) {
    try {
      const res = await uploadAndRecord(file, 'course_cover', sign, authedRequest);
      setForm((f) => ({ ...f, coverImageUrl: res.url, coverPublicId: res.publicId }));
      setUploadNote('');
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function onCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) void handleCoverFile(file);
  }

  async function addModule() {
    setError('');
    try {
      const id = await ensureCourseId();
      const title = `Module ${form.modules.length + 1}`;
      const res = await authedRequest<{ module: CourseModule }>(`/api/courses/${id}/modules`, {
        method: 'POST',
        body: { title },
      });
      setForm((f) => ({ ...f, modules: [...f.modules, { ...res.module, lessons: [] }] }));
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not add module');
    }
  }

  async function addLesson(moduleId: string) {
    setError('');
    try {
      const id = await ensureCourseId();
      const lessonTitle = 'New lesson';
      const res = await authedRequest<{ lesson: CourseModuleLesson }>(`/api/courses/${id}/lessons`, {
        method: 'POST',
        body: { moduleId, title: lessonTitle, type: 'video' },
      });
      setForm((f) => ({
        ...f,
        modules: f.modules.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, { ...res.lesson, sortOrder: m.lessons.length }] } : m,
        ),
      }));
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not add lesson');
    }
  }

  async function save(publish: boolean) {
    setBusy(true);
    setError('');
    try {
      const body = buildBody(form);
      let id = form.id;
      if (id) {
        await authedRequest(`/api/courses/${id}`, { method: 'PATCH', body });
      } else {
        const res = await authedRequest<{ course: { id: string } }>('/api/courses', { method: 'POST', body });
        id = res.course.id;
        setForm((f) => ({ ...f, id }));
      }

      if (publish && id) {
        await authedRequest(`/api/courses/${id}/publish`, { method: 'POST' });
        onSaved(id);
      } else {
        alert('Draft saved');
        setSavedNote('Draft saved');
        setTimeout(() => setSavedNote(''), 2500);
      }
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save course');
    } finally {
      setBusy(false);
    }
  }

  function nextTab() {
    const order: EditorTab[] = ['thumbnail', 'checkout', 'course', 'options'];
    const i = order.indexOf(tab);
    if (i >= 0 && i < order.length - 1) setTab(order[i + 1]!);
  }

  const tabs: { value: EditorTab; label: string; icon: React.ReactNode }[] = [
    { value: 'thumbnail', label: 'Thumbnail', icon: <IconImage size={16} /> },
    { value: 'checkout', label: 'Checkout', icon: <IconCartGlyph size={16} /> },
    { value: 'course', label: 'Course', icon: <IconGradCapTabGlyph size={16} /> },
    { value: 'options', label: 'Options', icon: <IconSlidersGlyph size={16} /> },
  ];

  return (
    <div className={cn('product-editor', tab === 'options' && 'product-editor--options')}>
      <EditorTopBar title={form.id ? 'Edit Course' : 'Add New Course'} />
      <div className="pe-layout">
        <div className="pe-main min-w-0">
          <div className="mb-8 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn('pe-tab', tab === t.value && 'pe-tab--active')}
              >
                <span className="pe-tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {error && <Alert kind="error" className="mb-4">{error}</Alert>}
          {savedNote && <Alert kind="success" className="mb-4">{savedNote}</Alert>}
          {uploadNote && <Alert kind="info" className="mb-4">{uploadNote}</Alert>}

          {tab === 'thumbnail' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Pick style" />
                <div className="pe-section-inner flex flex-wrap gap-3">
                  {(['button', 'callout', 'preview'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => patch('thumbnailStyle', style)}
                      className={cn('pe-style-card', form.thumbnailStyle === style && 'pe-style-card--active')}
                    >
                      <div className="pe-style-card-icon">{STYLE_ICON[style]}</div>
                      <div className="pe-style-card-label">{STYLE_LABELS[style]}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="pe-section">
                <Step n={2} label="Select image" />
                <div className="pe-section-inner pe-upload-row">
                  <div className="relative shrink-0">
                    {form.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.coverImageUrl} alt="" className="h-[72px] w-[72px] rounded-[10px] object-cover" />
                    ) : (
                      <div className="grid h-[72px] w-[72px] place-items-center rounded-[10px] bg-[#eaf0ff]">
                        <IconBook size={30} className="text-[#3d63ff]" />
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
                    <p className="text-sm font-medium text-[#3d3d4a]">Thumbnail</p>
                    <p className="text-xs text-[#8b8d98]">400×400</p>
                    <button type="button" onClick={pickCover} className="pe-btn-outline mt-2.5 cursor-pointer">
                      Choose Image
                    </button>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <Step n={3} label="Add text" />
                <div className="pe-section-inner space-y-4">
                  <CharField label="Title" value={form.title} onChange={(v) => patch('title', v)} max={140} />
                  <CharField label="Subtitle" value={form.shortDescription} onChange={(v) => patch('shortDescription', v)} max={300} />
                  <CharField label="Button" required value={form.thumbnailButtonLabel} onChange={(v) => patch('thumbnailButtonLabel', v)} max={30} />
                </div>
              </section>
            </div>
          )}

          {tab === 'checkout' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Select image" />
                <div className="pe-section-inner pe-upload-row">
                  <div className="relative shrink-0">
                    {form.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.coverImageUrl} alt="" className="h-[88px] w-[130px] rounded-[10px] object-cover" />
                    ) : (
                      <div className="flex h-[88px] w-[130px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8]">
                        <IconBook size={30} className="text-[#3d63ff]" />
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
                  <div
                    className={cn('pe-upload-drop', dragOver && 'border-[#6355fa] bg-[#f5f4ff]')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onCoverDrop}
                  >
                    <p className="text-sm font-medium text-[#3d3d4a]">Drag Your Image Here</p>
                    <p className="mt-1 text-xs text-[#8b8d98]">1920 × 1080 recommended</p>
                    <button type="button" onClick={pickCover} className="pe-btn-outline mt-3 cursor-pointer">
                      Choose Image
                    </button>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <Step n={2} label="Write description" />
                <div className="pe-section-inner space-y-4">
                  <CharField label="Title" required value={form.title} onChange={(v) => patch('title', v)} max={140} />
                  <div>
                    <label className="mb-1.5 block pe-field-label">
                      Description Body<span className="pe-field-req">*</span>
                    </label>
                    <div className="pe-desc-box">
                      <div className="pe-toolbar">
                        {[
                          { label: 'B', wrap: '**', title: 'Bold' },
                          { label: 'I', wrap: '_', title: 'Italic' },
                          { label: 'S', wrap: '~~', title: 'Strikethrough' },
                        ].map(({ label, wrap, title }) => (
                          <DescToolbarBtn
                            key={label}
                            title={title}
                            onClick={() => {
                              if (!descRef) return;
                              const { next, cursor } = wrapSelection(descRef, wrap);
                              patch('description', next);
                              requestAnimationFrame(() => {
                                descRef.focus();
                                descRef.setSelectionRange(cursor, cursor);
                              });
                            }}
                          >
                            <span className="text-xs font-bold">{label}</span>
                          </DescToolbarBtn>
                        ))}
                        <span className="mx-0.5 h-4 w-px bg-[#e4e5eb]" />
                        <DescToolbarBtn
                          title="Bullet list"
                          onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}• `)}
                        >
                          <span className="text-sm leading-none">≡</span>
                        </DescToolbarBtn>
                        <DescToolbarBtn
                          title="Numbered list"
                          onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}1. `)}
                        >
                          <span className="text-[10px] font-bold">1.</span>
                        </DescToolbarBtn>
                        <button
                          type="button"
                          onClick={() => patch('description', generateCourseDescription())}
                          className="pe-toolbar-ai inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-white"
                        >
                          ✨ Generate with AI
                        </button>
                      </div>
                      <textarea
                        ref={setDescRef}
                        rows={8}
                        value={form.description}
                        onChange={(e) => patch('description', e.target.value)}
                        className="pe-desc-area"
                        placeholder="Describe your course..."
                      />
                    </div>
                  </div>
                  <CharField label="Bottom Title" required value={form.bottomTitle} onChange={(v) => patch('bottomTitle', v)} max={140} variant="outline" />
                  <CharField label="Call-to-Action Button" required value={form.ctaLabel} onChange={(v) => patch('ctaLabel', v)} max={80} variant="outline" />
                </div>
              </section>

              <section className="pe-section">
                <Step n={3} label="Set price" />
                <div className="pe-section-inner space-y-4">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block pe-field-label">Payment type</label>
                      <div className="pe-segment">
                        <button
                          type="button"
                          onClick={() => patch('billingInterval', 'one_time')}
                          className={cn('pe-segment-btn', form.billingInterval === 'one_time' ? 'pe-segment-btn--active' : 'pe-segment-btn--idle')}
                        >
                          One-Time Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => patch('billingInterval', 'month')}
                          className={cn('pe-segment-btn', form.billingInterval !== 'one_time' ? 'pe-segment-btn--active' : 'pe-segment-btn--idle')}
                        >
                          Subscription
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block pe-field-label">
                        Price($)<span className="pe-field-req">*</span>
                      </label>
                      <input
                        value={form.priceDollars}
                        onChange={(e) => patch('priceDollars', e.target.value)}
                        className="pe-input-outline"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <label className="pe-field-label">Discount Price($)</label>
                      <Toggle on={form.discountEnabled} onChange={(v) => patch('discountEnabled', v)} />
                    </div>
                    <input
                      disabled={!form.discountEnabled}
                      value={form.discountPriceDollars}
                      onChange={(e) => patch('discountPriceDollars', e.target.value)}
                      className="pe-input"
                      placeholder="0.00"
                    />
                  </div>

                  {!priceProUnlocked && (
                    <div className="pe-locked-box">
                      <div className="pe-locked-blur space-y-3">
                        {['Add Payment Plan', 'Add Discount Code', 'Limit Quantity'].map((l) => (
                          <div key={l} className="flex items-center gap-3 text-sm text-[#6b7280]">
                            <IconLock size={14} className="shrink-0 text-[#9ca3af]" />
                            {l}
                          </div>
                        ))}
                      </div>
                      <div className="pe-locked-overlay">
                        <button type="button" onClick={() => setPriceProUnlocked(true)} className="pe-btn-outline">
                          <IconLock size={15} /> Upgrade to Unlock
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <CollectInfoFields form={form} setForm={setForm} step={4} />
            </div>
          )}

          {tab === 'course' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Course homepage" />
                <div className="pe-section-inner space-y-4">
                  <div className="rounded-2xl border border-[#e7e8f0] bg-[#fafaff] p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8b8d98]">Homepage</div>
                    <div className="flex gap-3">
                      {form.homepageCoverImageUrl || form.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.homepageCoverImageUrl || form.coverImageUrl}
                          alt=""
                          className="h-[66px] w-[100px] rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid h-[66px] w-[100px] place-items-center rounded-xl bg-[#eaf0ff]">
                          <IconBook size={24} className="text-[#3d63ff]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[#1a1a2e]">{form.homepageTitle || 'My 12-week Program'}</div>
                        <a
                          href={form.id ? `/dashboard/courses/${form.id}/homepage` : '#'}
                          className={cn('mt-2 inline-block text-sm font-semibold text-[#6355fa] hover:underline', !form.id && 'pointer-events-none opacity-50')}
                        >
                          Edit Page &gt;
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <CharField label="Homepage title" value={form.homepageTitle} onChange={(v) => patch('homepageTitle', v)} max={140} variant="outline" />
                    <div>
                      <label className="mb-1.5 block pe-field-label">Homepage cover</label>
                      <button type="button" onClick={pickHomepageCover} className="pe-btn-outline cursor-pointer">
                        Upload Cover
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <Step n={2} label="Add modules" />
                <div className="pe-section-inner space-y-3">
                  {form.modules.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#d6d8e3] bg-[#fafbff] px-4 py-3 text-sm text-[#7a7d8c]">
                      No modules yet. Click <strong>+ Add Module</strong> to start your curriculum.
                    </p>
                  )}
                  {form.modules.map((module, idx) => (
                    <div key={module.id} className="rounded-xl border border-[#e4e5eb] bg-white p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-5 w-5 place-items-center text-[#b5b9c8]">
                            <span className="grid grid-cols-2 gap-[2px]">
                              {Array.from({ length: 6 }).map((_, i) => (
                                <span key={i} className="h-[2px] w-[2px] rounded-full bg-current" />
                              ))}
                            </span>
                          </span>
                          <span className="truncate text-sm font-semibold text-[#1a1a2e]">
                            {idx + 1}. {module.title}
                          </span>
                          {module.status === 'published' && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Published
                            </span>
                          )}
                        </div>
                        <button type="button" onClick={() => void addLesson(module.id)} className="pe-btn-outline !px-2.5 !py-1.5 text-xs">
                          + Add Lesson
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {module.lessons.length > 0 ? (
                          module.lessons.map((lesson) => (
                            <a
                              key={lesson.id}
                              href={form.id ? `/dashboard/courses/${form.id}/lessons/${lesson.id}` : '#'}
                              className={cn(
                                'flex items-center justify-between rounded-lg border border-[#eceef5] bg-[#fbfcff] px-3 py-2 text-sm text-[#3f4352] transition hover:border-[#d6daf0] hover:bg-white',
                                !form.id && 'pointer-events-none opacity-60',
                              )}
                            >
                              <span className="truncate">{lesson.title}</span>
                              <span className="text-xs text-[#8b8d98]">{lesson.type}</span>
                            </a>
                          ))
                        ) : (
                          <p className="rounded-lg border border-dashed border-[#dfe2eb] px-3 py-2 text-xs text-[#8b8d98]">
                            No lessons in this module yet.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => void addModule()} className="pe-btn-outline">
                    + Add Module
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === 'options' && (
            <div className="space-y-3">
              <AccordionPanel
                icon={<IconSmile size={18} />}
                title="Add Reviews"
                open={openOption === 'reviews'}
                onToggle={() => setOpenOption(openOption === 'reviews' ? null : 'reviews')}
              >
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input
                    type="checkbox"
                    checked={localOptions.reviewsEnabled}
                    onChange={(e) => setLocalOptions((s) => ({ ...s, reviewsEnabled: e.target.checked }))}
                    className="rounded border-[#e4e5eb] accent-[#6355fa]"
                  />
                  Show reviews on checkout
                </label>
                <div className="space-y-3">
                  {localOptions.reviews.map((review) => (
                    <div key={review.id} className="pe-subpanel space-y-2">
                      <input
                        value={review.author}
                        onChange={(e) =>
                          setLocalOptions((s) => ({
                            ...s,
                            reviews: s.reviews.map((x) => (x.id === review.id ? { ...x, author: e.target.value } : x)),
                          }))
                        }
                        placeholder="Author name"
                        className="pe-input"
                      />
                      <textarea
                        value={review.quote}
                        onChange={(e) =>
                          setLocalOptions((s) => ({
                            ...s,
                            reviews: s.reviews.map((x) => (x.id === review.id ? { ...x, quote: e.target.value } : x)),
                          }))
                        }
                        placeholder="Review quote"
                        rows={2}
                        className="pe-textarea resize-y min-h-[60px]"
                      />
                      <div className="flex items-center justify-between">
                        <select
                          value={review.rating}
                          onChange={(e) =>
                            setLocalOptions((s) => ({
                              ...s,
                              reviews: s.reviews.map((x) =>
                                x.id === review.id ? { ...x, rating: parseInt(e.target.value, 10) } : x,
                              ),
                            }))
                          }
                          className="rounded-lg border border-[#e4e5eb] px-2 py-1 text-sm"
                        >
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {n} stars
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalOptions((s) => ({
                              ...s,
                              reviews: s.reviews.filter((x) => x.id !== review.id),
                            }))
                          }
                          className="text-xs font-semibold text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLocalOptions((s) => ({
                      ...s,
                      reviewsEnabled: true,
                      reviews: [...s.reviews, { id: uid(), author: '', quote: '', rating: 5 }],
                    }))
                  }
                  className="pe-add-link mt-2"
                >
                  + Add review
                </button>
              </AccordionPanel>

              <AccordionPanel
                icon={<IconMail size={18} />}
                title="Email Flows"
                open={openOption === 'email-flows'}
                onToggle={() => setOpenOption(openOption === 'email-flows' ? null : 'email-flows')}
              >
                <p className="mb-3 text-xs text-[#8b8d98]">
                  Automated follow-up emails sent after purchase (day 0 = immediately).
                </p>
                <div className="space-y-3">
                  {form.emailFlows.map((step) => (
                    <div key={step.id} className="pe-subpanel space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-xs font-semibold text-[#1a1a2e]">
                          <input
                            type="checkbox"
                            checked={step.enabled}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                emailFlows: f.emailFlows.map((x) =>
                                  x.id === step.id ? { ...x, enabled: e.target.checked } : x,
                                ),
                              }))
                            }
                            className="accent-[#6355fa]"
                          />
                          Enabled
                        </label>
                        <span className="text-xs text-[#8b8d98]">Send after</span>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          value={step.dayOffset}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              emailFlows: f.emailFlows.map((x) =>
                                x.id === step.id ? { ...x, dayOffset: parseInt(e.target.value || '0', 10) } : x,
                              ),
                            }))
                          }
                          className="w-16 rounded-lg border border-[#e4e5eb] px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-[#8b8d98]">days</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              emailFlows: f.emailFlows.filter((x) => x.id !== step.id),
                            }))
                          }
                          className="ml-auto text-xs font-semibold text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        value={step.subject}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            emailFlows: f.emailFlows.map((x) => (x.id === step.id ? { ...x, subject: e.target.value } : x)),
                          }))
                        }
                        placeholder="Email subject"
                        className="pe-input"
                      />
                      <textarea
                        value={step.body}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            emailFlows: f.emailFlows.map((x) => (x.id === step.id ? { ...x, body: e.target.value } : x)),
                          }))
                        }
                        placeholder="Email body"
                        rows={3}
                        className="pe-textarea resize-y min-h-[80px]"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      emailFlows: [
                        ...f.emailFlows,
                        {
                          id: uid(),
                          dayOffset: f.emailFlows.length + 1,
                          subject: 'Following up on your course',
                          body: 'Thanks again for enrolling. Keep going — you got this!',
                          enabled: true,
                        } satisfies ProductEmailFlowStep,
                      ],
                    }))
                  }
                  className="pe-add-link mt-2"
                >
                  + Add email step
                </button>
              </AccordionPanel>

              <AccordionPanel
                icon={<IconBook size={18} />}
                title="Order Bump"
                open={openOption === 'order-bump'}
                onToggle={() => setOpenOption(openOption === 'order-bump' ? null : 'order-bump')}
              >
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input
                    type="checkbox"
                    checked={localOptions.orderBump.enabled}
                    onChange={(e) =>
                      setLocalOptions((s) => ({ ...s, orderBump: { ...s.orderBump, enabled: e.target.checked } }))
                    }
                    className="rounded border-[#e4e5eb] accent-[#6355fa]"
                  />
                  Show order bump at checkout
                </label>
                <CharField
                  label="Title"
                  value={localOptions.orderBump.title}
                  onChange={(v) => setLocalOptions((s) => ({ ...s, orderBump: { ...s.orderBump, title: v } }))}
                  max={140}
                />
                <div className="mt-3">
                  <CharField
                    label="Description"
                    value={localOptions.orderBump.description}
                    onChange={(v) => setLocalOptions((s) => ({ ...s, orderBump: { ...s.orderBump, description: v } }))}
                    max={500}
                    multiline
                    rows={2}
                  />
                </div>
                <div className="mt-3">
                  <label className="mb-1.5 block pe-field-label">Bump price ($)</label>
                  <input
                    value={localOptions.orderBump.priceDollars}
                    onChange={(e) => setLocalOptions((s) => ({ ...s, orderBump: { ...s.orderBump, priceDollars: e.target.value } }))}
                    className="pe-input"
                  />
                </div>
              </AccordionPanel>

              <AccordionPanel
                icon={<IconUsers size={18} />}
                title="Affiliate Share"
                open={openOption === 'affiliate'}
                onToggle={() => setOpenOption(openOption === 'affiliate' ? null : 'affiliate')}
              >
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input
                    type="checkbox"
                    checked={localOptions.affiliate.enabled}
                    onChange={(e) =>
                      setLocalOptions((s) => ({ ...s, affiliate: { ...s.affiliate, enabled: e.target.checked } }))
                    }
                    className="rounded border-[#e4e5eb] accent-[#6355fa]"
                  />
                  Enable affiliate sharing
                </label>
                <div>
                  <label className="mb-1.5 block pe-field-label">Commission (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={localOptions.affiliate.commissionPercent}
                    onChange={(e) =>
                      setLocalOptions((s) => ({
                        ...s,
                        affiliate: {
                          ...s.affiliate,
                          commissionPercent: Math.min(90, Math.max(1, parseInt(e.target.value || '20', 10))),
                        },
                      }))
                    }
                    className="w-24 pe-input"
                  />
                </div>
              </AccordionPanel>

              <AccordionPanel
                icon={<IconMail size={18} />}
                title="Confirmation Email"
                open={openOption === 'confirmation'}
                onToggle={() => setOpenOption(openOption === 'confirmation' ? null : 'confirmation')}
              >
                <CharField label="Subject" value={form.confirmSubject} onChange={(v) => patch('confirmSubject', v)} max={200} />
                <div className="mt-4">
                  <CharField label="Body" value={form.confirmBody} onChange={(v) => patch('confirmBody', v)} max={5000} multiline rows={5} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    patch('confirmSubject', DEFAULT_CONFIRM_SUBJECT);
                    patch('confirmBody', DEFAULT_CONFIRM_BODY);
                  }}
                  className="pe-add-link mt-2"
                >
                  Restore Default
                </button>
              </AccordionPanel>
            </div>
          )}

          <div className="mt-12 border-t border-[#e4e5eb] pt-6">
            <p className="pe-footer-note">Improve this page</p>
            <div className="pe-footer-actions">
              <button type="button" disabled={busy} onClick={() => void save(false)} className="pe-btn-outline disabled:opacity-50">
                <IconSaveGlyph /> Save As Draft
              </button>
              {tab !== 'options' ? (
                <button type="button" disabled={busy} onClick={nextTab} className="pe-btn-solid disabled:opacity-50">
                  Next
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => void save(true)} className="pe-btn-solid disabled:opacity-50">
                  Publish
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pe-preview-col">
          {tab === 'thumbnail' ? (
            <div className="pe-preview-thumb">
              <ThumbnailPreviewCard form={form} />
            </div>
          ) : (
            <div className="pe-phone-wrap">
              <PhoneFrame>
                {tab === 'course' ? (
                  <CourseHomepagePreview form={form} />
                ) : tab === 'options' ? (
                  <CheckoutPreview
                    form={form}
                    showHeroBack={false}
                    showTotal={false}
                    showFormFields={false}
                    showPurchaseCta
                    bottomTitleAsFooter
                    ctaDark
                  />
                ) : (
                  <CheckoutPreview
                    form={form}
                    showHeroBack
                    showTotal
                    showFormFields
                    showPurchaseCta
                    bottomTitleAsFooter={false}
                  />
                )}
              </PhoneFrame>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildBody(form: CourseEditorState) {
  const priceCents = Math.round(parseFloat(form.priceDollars || '0') * 100);
  const discountPriceCents =
    form.discountEnabled && form.discountPriceDollars ? Math.round(parseFloat(form.discountPriceDollars || '0') * 100) : 0;

  return {
    title: form.title,
    shortDescription: form.shortDescription,
    description: form.description || form.shortDescription,
    priceCents,
    coverImageUrl: form.coverImageUrl,
    coverPublicId: form.coverPublicId,
    discountPriceCents,
    discountEnabled: form.discountEnabled,
    billingInterval: form.billingInterval,
    thumbnailStyle: form.thumbnailStyle,
    thumbnailButtonLabel: form.thumbnailButtonLabel,
    bottomTitle: form.bottomTitle,
    ctaLabel: form.ctaLabel,
    homepageTitle: form.homepageTitle,
    homepageDescription: form.homepageDescription || form.description,
    homepageCoverImageUrl: form.homepageCoverImageUrl,
    homepageCoverPublicId: form.homepageCoverPublicId,
    titleFont: form.titleFont,
    backgroundColor: form.backgroundColor,
    highlightColor: form.highlightColor,
    confirmSubject: form.confirmSubject,
    confirmBody: form.confirmBody,
  };
}
