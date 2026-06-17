'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import {
  IconArrowLeft,
  IconBell,
  IconCalendar,
  IconChevronDown,
  IconClock,
  IconGlobe,
  IconImage,
  IconLock,
  IconMail,
  IconPencil,
  IconPlay,
  IconSmile,
  IconTrash,
  IconTrending,
  IconUsers,
} from '@/components/icons';
import { uploadAndRecord, type SignKind } from '@/lib/upload';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { cn } from '@/lib/cn';
import { EditorTopBar } from '@/components/stan/EditorTopBar';
import {
  buildWebinarBody,
  formatSlotDateLabel,
  formatSlotTimeLabel,
  generateWebinarDescription,
  getUpcomingSlots,
  timezonePreviewLabel,
  WEBINAR_CALENDAR_OPTIONS,
  WEBINAR_DURATION_OPTIONS,
  WEBINAR_REMINDER_HOURS,
  WEBINAR_TIMEZONES,
  type WebinarEditorState,
  type WebinarSlot,
} from '@/lib/webinar-types';
import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  type ProductCustomField,
  type ProductEmailFlowStep,
} from '@/lib/product-options';

export type { WebinarEditorState } from '@/lib/webinar-types';

type EditorTab = 'thumbnail' | 'checkout' | 'webinar' | 'options';

type ReviewRow = { id: string; author: string; quote: string; rating: number };
type OrderBumpState = { enabled: boolean; title: string; description: string; priceDollars: string };
type AffiliateState = { enabled: boolean; commissionPercent: number };

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

function IconUserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
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

function IconWebinarTabGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M8 20h8" />
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

function IconFolderGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 7.2A1.7 1.7 0 0 1 4.7 5.5h3.9a1.7 1.7 0 0 1 1.2.5l1.1 1.1h7.4A1.7 1.7 0 0 1 21 8.8v1.2H3z" fill="#f4a259" />
      <path d="M3 9.2h18a1.5 1.5 0 0 1 1.48 1.77l-1.1 6A1.5 1.5 0 0 1 19.9 18.2H4.1a1.5 1.5 0 0 1-1.48-1.23l-1.1-6A1.5 1.5 0 0 1 3 9.2z" fill="#f7b977" />
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

const STYLE_ICON: Record<WebinarEditorState['thumbnailStyle'], React.ReactNode> = {
  button: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="9" width="18" height="6" rx="3" />
    </svg>
  ),
  callout: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  ),
  preview: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M10.5 9.2 15 12l-4.5 2.8z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const STYLE_LABELS: Record<WebinarEditorState['thumbnailStyle'], string> = {
  button: 'Button',
  callout: 'Callout',
  preview: 'Preview',
};

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
  variant = 'default',
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  variant?: 'default' | 'outline';
}) {
  const cls = variant === 'outline' ? 'pe-input-outline' : 'pe-input';
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
          className={cn(cls, 'resize-y min-h-[88px]')}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

function DescToolbarBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick} className="pe-toolbar-btn">
      {children}
    </button>
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

function ThumbnailPreviewCard({ form }: { form: WebinarEditorState }) {
  const price = `$${form.priceDollars || '9.99'}`;
  const btnLabel = form.thumbnailButtonLabel || form.ctaLabel || 'Claim Your Spot';

  if (form.thumbnailStyle === 'button') {
    return (
      <div className="pe-preview-card pe-preview-card--button">
        <div className="text-[13px] font-bold text-[#1a1a2e]">{form.title || 'Product title'}</div>
        <button type="button" className="pe-preview-cta mt-3">{btnLabel}</button>
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
            <IconFolderGlyph size={36} />
          </div>
        )}
        <div className="pe-preview-body">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Product title'}</div>
          {form.shortDescription && <p className="mt-1 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
          <button type="button" className="pe-preview-cta mt-3">{btnLabel}</button>
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
            <IconFolderGlyph size={28} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Product title'}</div>
          {form.shortDescription && <p className="mt-0.5 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
        </div>
      </div>
      <button type="button" className="pe-preview-cta">{btnLabel}</button>
    </div>
  );
}

function WebinarCheckoutPreview({
  form,
  showBack,
  showHeroBack,
  showTotal,
  showFormFields,
  showPurchaseCta,
  showSlotSection,
}: {
  form: WebinarEditorState;
  showBack?: boolean;
  showHeroBack?: boolean;
  showTotal?: boolean;
  showFormFields?: boolean;
  showPurchaseCta?: boolean;
  showSlotSection?: boolean;
}) {
  const baseCents =
    form.discountEnabled && form.discountPriceDollars
      ? Math.round(parseFloat(form.discountPriceDollars) * 100)
      : Math.round(parseFloat(form.priceDollars || '0') * 100);
  const priceDisplay = formatUsPrice(baseCents / 100);
  const priceShort = `$${(baseCents / 100).toFixed(2)}`;
  const lines = (form.description || '').split('\n').filter(Boolean);
  const upcoming = getUpcomingSlots(form.slots);
  const hasSlots = upcoming.length > 0;

  return (
    <div className="min-h-full bg-white px-3.5 pb-8 pt-2">
      {showBack && (
        <button type="button" aria-label="Back" className="pe-preview-back">
          <IconArrowLeft size={18} />
        </button>
      )}
      <div className="relative mb-3.5">
        {showHeroBack && (
          <button type="button" aria-label="Back" className="absolute left-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#1a1a2e] shadow-sm">
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
      <h1 className="text-[16px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Product title'}</h1>
      <p className="mt-0.5 text-[15px] font-bold text-[#6355fa]">{priceShort}</p>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[#4b5563]">
          {lines.map((line, i) => renderDescriptionLine(line, i))}
        </div>
      )}
      {form.bottomTitle && (
        <h2 className="mt-5 text-center text-[15px] font-bold text-[#1a1a2e]">{form.bottomTitle}</h2>
      )}
      {showSlotSection && (
        <div className="mt-3 text-center">
          {hasSlots ? (
            <>
              <button type="button" className="text-sm font-semibold text-[#6355fa] hover:underline">
                Choose Your Slot
              </button>
              <p className="mt-1 text-xs font-medium text-[#6355fa]">{timezonePreviewLabel(form.timezone)}</p>
            </>
          ) : (
            <p className="text-xs font-medium leading-relaxed text-[#6355fa]">
              Currently, there are no upcoming events. Please check back later!
            </p>
          )}
        </div>
      )}
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
          <span className="font-bold text-[#6355fa]">{priceDisplay}</span>
        </div>
      )}
      {showPurchaseCta && (
        <button type="button" className="pe-preview-cta mt-4 uppercase tracking-wide">
          {form.ctaLabel || 'Secure Your Spot'}
        </button>
      )}
    </div>
  );
}

function CollectInfoFields({
  form,
  setForm,
  step,
}: {
  form: WebinarEditorState;
  setForm: React.Dispatch<React.SetStateAction<WebinarEditorState>>;
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
              <span className="text-[#a1a1aa]">{f === 'Name' ? <IconUserGlyph /> : <IconMail size={16} />}</span>
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
                  className="rounded-lg border border-[#e4e5eb] bg-white px-2 py-1 text-xs"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="phone">Phone</option>
                </select>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, customFields: f.customFields.filter((x) => x.id !== field.id) }))}
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

function WebinarSlotRow({
  slot,
  onChange,
  onRemove,
  canRemove,
}: {
  slot: WebinarSlot;
  onChange: (patch: Partial<WebinarSlot>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="pe-avail-slot">
      <label className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
          <IconCalendar size={16} />
        </span>
        <input
          type="date"
          value={slot.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="w-full rounded-lg border border-[#e4e5eb] bg-white py-2.5 pl-10 pr-3 text-sm text-[#1a1a2e] outline-none focus:border-[#6355fa]"
        />
        <span className="sr-only">{formatSlotDateLabel(slot.date)}</span>
      </label>
      <label className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
          <IconClock size={16} />
        </span>
        <input
          type="time"
          value={slot.time}
          onChange={(e) => onChange({ time: e.target.value })}
          className="w-full rounded-lg border border-[#e4e5eb] bg-white py-2.5 pl-10 pr-3 text-sm text-[#1a1a2e] outline-none focus:border-[#6355fa]"
        />
        <span className="sr-only">{formatSlotTimeLabel(slot.time)}</span>
      </label>
      {canRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove slot" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#9ca3af] hover:bg-red-50 hover:text-red-500">
          <IconTrash size={16} />
        </button>
      )}
    </div>
  );
}

export function WebinarEditor({ initial, onSaved }: { initial: WebinarEditorState; onSaved: (id: string) => void }) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<WebinarEditorState>(initial);
  const [tab, setTab] = useState<EditorTab>('thumbnail');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [descRef, setDescRef] = useState<HTMLTextAreaElement | null>(null);
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [priceProUnlocked, setPriceProUnlocked] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localReviews, setLocalReviews] = useState<{ enabled: boolean; items: ReviewRow[] }>({ enabled: false, items: [] });
  const [localOrderBump, setLocalOrderBump] = useState<OrderBumpState>({ enabled: false, title: '', description: '', priceDollars: '0.00' });
  const [localAffiliate, setLocalAffiliate] = useState<AffiliateState>({ enabled: false, commissionPercent: 20 });

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

  const patch = useCallback(<K extends keyof WebinarEditorState>(key: K, value: WebinarEditorState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const { open: openMediaLibrary } = useMediaLibrary();

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

  // Direct upload kept for drag-and-drop; also records into the media library.
  async function handleCoverFile(file: File) {
    try {
      const res = await uploadAndRecord(file, 'product_cover', sign, authedRequest);
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

  async function save(publish: boolean) {
    setBusy(true);
    setError('');
    try {
      const body = buildWebinarBody(form);
      let id = form.id;
      if (id) {
        await authedRequest(`/api/webinars/${id}`, { method: 'PATCH', body });
      } else {
        const res = await authedRequest<{ webinar: { id: string } }>('/api/webinars', { method: 'POST', body });
        id = res.webinar.id;
        setForm((f) => ({ ...f, id }));
      }
      if (publish && id) {
        await authedRequest(`/api/webinars/${id}/publish`, { method: 'POST' });
        onSaved(id);
      } else {
        setSavedNote('Draft saved');
        setTimeout(() => setSavedNote(''), 2500);
      }
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save webinar');
    } finally {
      setBusy(false);
    }
  }

  function nextTab() {
    const order: EditorTab[] = ['thumbnail', 'checkout', 'webinar', 'options'];
    const i = order.indexOf(tab);
    if (i >= 0 && i < order.length - 1) setTab(order[i + 1]!);
  }

  const tabs: { value: EditorTab; label: string; icon: React.ReactNode }[] = [
    { value: 'thumbnail', label: 'Thumbnail', icon: <IconImage size={16} /> },
    { value: 'checkout', label: 'Checkout Page', icon: <IconCartGlyph size={16} /> },
    { value: 'webinar', label: 'Webinar', icon: <IconWebinarTabGlyph size={16} /> },
    { value: 'options', label: 'Options', icon: <IconSlidersGlyph size={16} /> },
  ];

  const isPublishTab = tab === 'webinar' || tab === 'options';
  const previewShowSlots = tab !== 'thumbnail';
  const previewHasUpcoming = getUpcomingSlots(form.slots).length > 0;
  const checkoutShowForm = tab === 'checkout';
  const checkoutShowTotal = tab === 'checkout';
  const checkoutShowCta = tab === 'checkout';
  const optionsShowCta = tab === 'options' && previewHasUpcoming;

  return (
    <div className={cn('product-editor', tab === 'options' && 'product-editor--options')}>
      <EditorTopBar title={form.id ? 'Edit Webinar' : 'Add New Webinar'} />
      <div className="pe-layout">
        <div className="pe-main min-w-0">
          <div className="mb-8 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button key={t.value} type="button" onClick={() => setTab(t.value)} className={cn('pe-tab', tab === t.value && 'pe-tab--active')}>
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
                <Step n={1} label="Pick a style" />
                <div className="pe-section-inner flex flex-wrap gap-3">
                  {(['button', 'callout', 'preview'] as const).map((style) => (
                    <button key={style} type="button" onClick={() => patch('thumbnailStyle', style)} className={cn('pe-style-card', form.thumbnailStyle === style && 'pe-style-card--active')}>
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
                        <IconPlay size={30} className="text-[#3d63ff]" />
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
                  <CharField label="Title" required value={form.title} onChange={(v) => patch('title', v)} max={50} />
                  <CharField label="Subtitle" value={form.shortDescription} onChange={(v) => patch('shortDescription', v)} max={100} multiline rows={2} />
                  <CharField label="Button" required value={form.thumbnailButtonLabel} onChange={(v) => patch('thumbnailButtonLabel', v)} max={30} />
                </div>
              </section>
            </div>
          )}

          {tab === 'checkout' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Select Image" />
                <div
                  className={cn('pe-section-inner pe-hero-drop', dragOver && 'pe-hero-drop--active')}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onCoverDrop}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative shrink-0">
                      {form.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.coverImageUrl} alt="" className="h-[72px] w-[100px] rounded-xl object-cover" />
                      ) : (
                        <div className="grid h-[72px] w-[100px] place-items-center rounded-xl bg-[#eaf0ff]">
                          <IconPlay size={28} className="text-[#3d63ff]" />
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
                    <div className="min-w-[160px] flex-1 text-center">
                      <p className="text-sm font-medium text-[#6b7280]">Drag Your Image Here</p>
                      <p className="mt-0.5 text-xs text-[#9ca3af]">1920 x 1080</p>
                    </div>
                    <button type="button" onClick={pickCover} className="pe-btn-outline cursor-pointer">
                      Choose Image
                    </button>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <Step n={2} label="Write Description" />
                <div className="pe-section-inner space-y-4">
                  <CharField label="Title" required value={form.title} onChange={(v) => patch('title', v)} max={140} variant="outline" />
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
                        <DescToolbarBtn title="Bullet list" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}• `)}>
                          <span className="text-sm leading-none">≡</span>
                        </DescToolbarBtn>
                        <button type="button" onClick={() => patch('description', generateWebinarDescription())} className="pe-toolbar-ai inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-white">
                          ✨ Generate with AI
                        </button>
                      </div>
                      <textarea ref={setDescRef} rows={8} value={form.description} onChange={(e) => patch('description', e.target.value)} className="pe-desc-area" placeholder="Describe your webinar..." />
                    </div>
                  </div>
                  <CharField label="Bottom Title" required value={form.bottomTitle} onChange={(v) => patch('bottomTitle', v)} max={80} variant="outline" />
                  <CharField label="Call-to-Action Button" required value={form.ctaLabel} onChange={(v) => patch('ctaLabel', v)} max={30} variant="outline" />
                </div>
              </section>

              <section className="pe-section">
                <Step n={3} label="Set price" />
                <div className="pe-section-inner space-y-4">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block pe-field-label">
                        Price($)<span className="pe-field-req">*</span>
                      </label>
                      <input value={form.priceDollars} onChange={(e) => patch('priceDollars', e.target.value)} className="pe-input-outline" inputMode="decimal" placeholder="0.00" />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <label className="pe-field-label">Discount Price($)</label>
                        <Toggle on={form.discountEnabled} onChange={(v) => patch('discountEnabled', v)} />
                      </div>
                      <input disabled={!form.discountEnabled} value={form.discountPriceDollars} onChange={(e) => patch('discountPriceDollars', e.target.value)} className="pe-input" inputMode="decimal" placeholder="0" />
                    </div>
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

          {tab === 'webinar' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Add webinar slots" />
                <div className="pe-section-inner space-y-3">
                  {form.slots.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#d6d8e3] bg-[#fafbff] px-4 py-3 text-sm text-[#7a7d8c]">
                      No webinar slots yet. Click <strong>+ Add Slot</strong> to schedule your event.
                    </p>
                  )}
                  {form.slots.map((slot, idx) => (
                    <WebinarSlotRow
                      key={slot.id}
                      slot={slot}
                      canRemove={form.slots.length > 0}
                      onChange={(p) =>
                        setForm((f) => ({
                          ...f,
                          slots: f.slots.map((s, i) => (i === idx ? { ...s, ...p } : s)),
                        }))
                      }
                      onRemove={() => setForm((f) => ({ ...f, slots: f.slots.filter((_, i) => i !== idx) }))}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        slots: [
                          ...f.slots,
                          {
                            id: uid(),
                            date: f.slots[f.slots.length - 1]?.date || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
                            time: '10:00',
                          },
                        ],
                      }))
                    }
                    className="pe-btn-outline w-full"
                  >
                    + Add Slot
                  </button>
                </div>
              </section>

              <section className="pe-section">
                <Step n={2} label="Configure webinar settings" />
                <div className="pe-section-inner grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block pe-field-label">Duration</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                        <IconClock size={16} />
                      </span>
                      <select
                        value={form.durationMin}
                        onChange={(e) => patch('durationMin', parseInt(e.target.value, 10))}
                        className="w-full rounded-lg border border-[#e4e5eb] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#6355fa]"
                      >
                        {WEBINAR_DURATION_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Timezone</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                        <IconGlobe size={16} />
                      </span>
                      <select
                        value={form.timezone}
                        onChange={(e) => patch('timezone', e.target.value)}
                        className="w-full rounded-lg border border-[#e4e5eb] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#6355fa]"
                      >
                        {WEBINAR_TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Calendar</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                        <IconCalendar size={16} />
                      </span>
                      <select
                        value={form.calendarIntegration}
                        onChange={(e) => patch('calendarIntegration', e.target.value)}
                        className="w-full rounded-lg border border-[#e4e5eb] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#6355fa]"
                      >
                        {WEBINAR_CALENDAR_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Capacity</label>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 text-[#9ca3af]">
                        <IconUsers size={16} />
                      </span>
                      <input
                        value={form.capacityPerSlot}
                        onChange={(e) => patch('capacityPerSlot', e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-lg border border-[#e4e5eb] bg-white py-2.5 pl-10 pr-16 text-sm outline-none focus:border-[#6355fa]"
                        inputMode="numeric"
                      />
                      <span className="pointer-events-none absolute right-3 text-xs text-[#9ca3af]">seats/slot</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'options' && (
            <div className="space-y-3">
              <AccordionPanel icon={<IconSmile size={18} />} title="Add Reviews" open={openOption === 'reviews'} onToggle={() => setOpenOption(openOption === 'reviews' ? null : 'reviews')}>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input type="checkbox" checked={localReviews.enabled} onChange={(e) => setLocalReviews((s) => ({ ...s, enabled: e.target.checked }))} className="rounded border-[#e4e5eb] accent-[#6355fa]" />
                  Show reviews on checkout
                </label>
                {localReviews.items.map((r) => (
                  <div key={r.id} className="mb-3 rounded-xl border border-[#e4e5eb] p-3">
                    <input value={r.author} onChange={(e) => setLocalReviews((s) => ({ ...s, items: s.items.map((x) => (x.id === r.id ? { ...x, author: e.target.value } : x)) }))} placeholder="Author" className="pe-input mb-2" />
                    <textarea value={r.quote} onChange={(e) => setLocalReviews((s) => ({ ...s, items: s.items.map((x) => (x.id === r.id ? { ...x, quote: e.target.value } : x)) }))} placeholder="Quote" rows={2} className="pe-textarea resize-y" />
                  </div>
                ))}
                <button type="button" onClick={() => setLocalReviews((s) => ({ ...s, items: [...s.items, { id: uid(), author: '', quote: '', rating: 5 }] }))} className="pe-add-link">
                  + Add review
                </button>
              </AccordionPanel>

              <AccordionPanel icon={<IconMail size={18} />} title="Email Flows" open={openOption === 'email-flows'} onToggle={() => setOpenOption(openOption === 'email-flows' ? null : 'email-flows')}>
                {form.emailFlows.map((step) => (
                  <div key={step.id} className="mb-3 rounded-xl border border-[#e4e5eb] p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#6b7280]">Day</span>
                      <input type="number" min={0} value={step.dayOffset} onChange={(e) => setForm((f) => ({ ...f, emailFlows: f.emailFlows.map((x) => (x.id === step.id ? { ...x, dayOffset: parseInt(e.target.value || '0', 10) } : x)) }))} className="w-16 rounded-lg border border-[#e4e5eb] px-2 py-1 text-sm" />
                      <button type="button" onClick={() => setForm((f) => ({ ...f, emailFlows: f.emailFlows.filter((x) => x.id !== step.id) }))} className="ml-auto text-xs font-semibold text-red-500 hover:underline">Remove</button>
                    </div>
                    <input value={step.subject} onChange={(e) => setForm((f) => ({ ...f, emailFlows: f.emailFlows.map((x) => (x.id === step.id ? { ...x, subject: e.target.value } : x)) }))} placeholder="Email subject" className="pe-input" />
                    <textarea value={step.body} onChange={(e) => setForm((f) => ({ ...f, emailFlows: f.emailFlows.map((x) => (x.id === step.id ? { ...x, body: e.target.value } : x)) }))} placeholder="Email body" rows={3} className="pe-textarea resize-y min-h-[80px]" />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      emailFlows: [
                        ...f.emailFlows,
                        { id: uid(), dayOffset: f.emailFlows.length + 1, subject: 'Webinar follow-up', body: 'Thanks for registering!', enabled: true } satisfies ProductEmailFlowStep,
                      ],
                    }))
                  }
                  className="pe-add-link mt-2"
                >
                  + Add email step
                </button>
              </AccordionPanel>

              <AccordionPanel icon={<IconBell size={18} />} title="Reminder" open={openOption === 'reminder'} onToggle={() => setOpenOption(openOption === 'reminder' ? null : 'reminder')}>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input type="checkbox" checked={form.reminderEnabled} onChange={(e) => patch('reminderEnabled', e.target.checked)} className="rounded border-[#e4e5eb] accent-[#6355fa]" />
                  Send reminder email before the webinar
                </label>
                <div>
                  <label className="mb-1.5 block pe-field-label">Send reminder</label>
                  <select
                    value={form.reminderHoursBefore}
                    onChange={(e) => patch('reminderHoursBefore', parseInt(e.target.value, 10))}
                    disabled={!form.reminderEnabled}
                    className="pe-input-outline max-w-xs disabled:opacity-50"
                  >
                    {WEBINAR_REMINDER_HOURS.map((h) => (
                      <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'} before</option>
                    ))}
                  </select>
                </div>
              </AccordionPanel>

              <AccordionPanel icon={<IconTrending size={18} />} title="Order Bump" open={openOption === 'order-bump'} onToggle={() => setOpenOption(openOption === 'order-bump' ? null : 'order-bump')}>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input type="checkbox" checked={localOrderBump.enabled} onChange={(e) => setLocalOrderBump((s) => ({ ...s, enabled: e.target.checked }))} className="rounded border-[#e4e5eb] accent-[#6355fa]" />
                  Show order bump at checkout
                </label>
                <CharField label="Title" value={localOrderBump.title} onChange={(v) => setLocalOrderBump((s) => ({ ...s, title: v }))} max={140} />
              </AccordionPanel>

              <AccordionPanel icon={<IconUsers size={18} />} title="Affiliate Share" open={openOption === 'affiliate'} onToggle={() => setOpenOption(openOption === 'affiliate' ? null : 'affiliate')}>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <input type="checkbox" checked={localAffiliate.enabled} onChange={(e) => setLocalAffiliate((s) => ({ ...s, enabled: e.target.checked }))} className="rounded border-[#e4e5eb] accent-[#6355fa]" />
                  Enable affiliate sharing
                </label>
                <div>
                  <label className="mb-1.5 block pe-field-label">Commission (%)</label>
                  <input type="number" min={1} max={90} value={localAffiliate.commissionPercent} onChange={(e) => setLocalAffiliate((s) => ({ ...s, commissionPercent: Math.min(90, Math.max(1, parseInt(e.target.value || '20', 10))) }))} className="w-24 pe-input" />
                </div>
              </AccordionPanel>

              <AccordionPanel icon={<IconMail size={18} />} title="Confirmation Email" open={openOption === 'confirmation'} onToggle={() => setOpenOption(openOption === 'confirmation' ? null : 'confirmation')}>
                <CharField label="Subject" value={form.confirmSubject} onChange={(v) => patch('confirmSubject', v)} max={200} />
                <div className="mt-4">
                  <CharField label="Body" value={form.confirmBody} onChange={(v) => patch('confirmBody', v)} max={5000} multiline rows={5} />
                </div>
                <button type="button" onClick={() => { patch('confirmSubject', DEFAULT_CONFIRM_SUBJECT); patch('confirmBody', DEFAULT_CONFIRM_BODY); }} className="pe-add-link mt-2">
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
              {isPublishTab ? (
                <button type="button" disabled={busy} onClick={() => void save(true)} className="pe-btn-solid disabled:opacity-50">
                  Publish
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={nextTab} className="pe-btn-solid disabled:opacity-50">
                  Next
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
                <WebinarCheckoutPreview
                  form={form}
                  showBack={tab === 'options'}
                  showHeroBack={tab === 'checkout'}
                  showTotal={checkoutShowTotal}
                  showFormFields={checkoutShowForm}
                  showPurchaseCta={checkoutShowCta || optionsShowCta}
                  showSlotSection={previewShowSlots}
                />
              </PhoneFrame>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
