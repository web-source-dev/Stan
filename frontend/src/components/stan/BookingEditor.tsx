'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import {
  IconArrowLeft,
  IconCalendar,
  IconChevronDown,
  IconImage,
  IconLock,
  IconMail,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@/components/icons';
import { uploadAndRecord, type SignKind } from '@/lib/upload';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import {
  BOOKING_TIMEZONES,
  BUFFER_OPTIONS,
  DURATION_OPTIONS,
  WEEKDAY_LABELS,
  generateCoachingDescription,
  timeToMinutes,
  type BookingEditorState,
} from '@/lib/booking-types';
export type { BookingEditorState } from '@/lib/booking-types';
import {
  DEFAULT_CONFIRM_BODY,
  DEFAULT_CONFIRM_SUBJECT,
  type ProductCustomField,
  type ProductEmailFlowStep,
} from '@/lib/product-options';
import { cn } from '@/lib/cn';
import { EditorTopBar } from '@/components/stan/EditorTopBar';

type EditorTab = 'thumbnail' | 'checkout' | 'availability' | 'options';

function uid() {
  return `_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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
            <strong key={i} className="font-bold text-[#1a1a2e]">{part.slice(2, -2)}</strong>
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

function IconCalendarGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
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

function IconSaveGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h7V3M8 21v-6h8v6" />
    </svg>
  );
}

const STYLE_ICON: Record<BookingEditorState['thumbnailStyle'], React.ReactNode> = {
  button: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="9" width="18" height="6" rx="3" /></svg>
  ),
  callout: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="5" width="18" height="11" rx="2" /><path d="M9 20h6M12 16v4" /></svg>
  ),
  preview: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M10.5 9.2 15 12l-4.5 2.8z" fill="currentColor" stroke="none" /></svg>
  ),
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
  label, required, value, onChange, max, multiline, rows = 3, variant = 'filled',
}: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void; max: number;
  multiline?: boolean; rows?: number; variant?: 'filled' | 'outline';
}) {
  const fieldClass = variant === 'outline' ? 'pe-input-outline' : multiline ? 'pe-textarea resize-y min-h-[88px]' : 'pe-input';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="pe-field-label">{label}{required && <span className="pe-field-req">*</span>}</label>
        <span className="pe-char-count">{value.length}/{max}</span>
      </div>
      {multiline ? (
        <textarea rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)}
          className={variant === 'outline' ? 'pe-input-outline resize-y min-h-[88px]' : 'pe-textarea resize-y min-h-[88px]'} />
      ) : (
        <input maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
      )}
    </div>
  );
}

const STYLE_LABELS: Record<BookingEditorState['thumbnailStyle'], string> = {
  button: 'Button',
  callout: 'Callout',
  preview: 'Preview',
};

function ThumbnailPreviewCard({ form }: { form: BookingEditorState }) {
  const price = `$${form.priceDollars || '9.99'}`;
  const btnLabel = form.thumbnailButtonLabel || form.title || 'Book a Call';

  if (form.thumbnailStyle === 'button') {
    return (
      <div className="pe-preview-card pe-preview-card--button">
        <div className="text-[13px] font-bold text-[#1a1a2e]">{form.title || 'Book a 1:1 Call with Me'}</div>
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
            <IconCalendarGlyph size={36} />
          </div>
        )}
        <div className="pe-preview-body">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Book a 1:1 Call with Me'}</div>
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
            <IconCalendarGlyph size={28} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Book a 1:1 Call with Me'}</div>
          {form.shortDescription && <p className="mt-0.5 text-[11px] leading-snug text-[#8b8d98]">{form.shortDescription}</p>}
          <div className="mt-1 text-[13px] font-bold text-[#6355fa]">{price}</div>
        </div>
      </div>
      <button type="button" className="pe-preview-cta">{btnLabel}</button>
    </div>
  );
}

function MiniMonthCalendar() {
  const now = new Date();
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = i - startPad + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });
  const selectedDay = Math.min(now.getDate(), daysInMonth);

  return (
    <div className="mt-3 rounded-xl border border-[#e4e5eb] p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="text-[#8b8d98]">←</button>
        <span className="rounded-full bg-[#6355fa] px-3 py-1 text-xs font-semibold text-white">{monthLabel}</span>
        <button type="button" className="text-[#8b8d98]">→</button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[#8b8d98]">
        {days.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {cells.map((d, i) => (
          <div key={i} className={cn(
            'grid h-7 w-7 place-items-center rounded-full mx-auto',
            d === selectedDay ? 'bg-[#6355fa] font-semibold text-white' : d ? 'text-[#4b5563]' : '',
          )}>
            {d ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingPhonePreview({
  form,
  showHeroBack,
  calendarMode,
  showFormFields,
  showTotal,
}: {
  form: BookingEditorState;
  showHeroBack?: boolean;
  calendarMode?: 'strip' | 'full' | 'none';
  showFormFields?: boolean;
  showTotal?: boolean;
}) {
  const price = parseFloat(form.discountEnabled && form.discountPriceDollars ? form.discountPriceDollars : form.priceDollars || '0');
  const lines = (form.description || '').split('\n').filter(Boolean);
  const now = new Date();
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-full bg-white px-3.5 pb-8 pt-2">
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
      <h1 className="text-[16px] font-bold leading-snug text-[#1a1a2e]">{form.title || 'Book a 1:1 Call with Me'}</h1>
      <p className="mt-0.5 text-[15px] font-bold text-[#6355fa]">${price.toFixed(2)}</p>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[#4b5563]">
          {lines.map((line, i) => renderDescriptionLine(line, i))}
        </div>
      )}
      {calendarMode !== 'none' && (
        <>
          {form.bottomTitle && <h2 className="mt-5 text-center text-[15px] font-bold text-[#1a1a2e]">{form.bottomTitle}</h2>}
          <p className="mt-2 text-sm font-semibold text-[#6355fa]">Choose Date</p>
          <p className="text-xs text-[#8b8d98]">{form.timezone.replace('_', '/')}</p>
          {calendarMode === 'full' ? (
            <MiniMonthCalendar />
          ) : (
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="text-[#8b8d98]">←</button>
              <span className="rounded-full bg-[#6355fa] px-4 py-1.5 text-sm font-semibold text-white">{monthLabel}</span>
              <button type="button" className="text-[#8b8d98]">→</button>
            </div>
          )}
        </>
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
          <span className="font-bold text-[#6355fa]">{formatUsPrice(price)}</span>
        </div>
      )}
      {(showFormFields || showTotal) && (
        <button type="button" className="pe-preview-cta mt-4 uppercase tracking-wide">{form.ctaLabel || 'Book a Call'}</button>
      )}
    </div>
  );
}

function CollectInfoFields({
  form,
  setForm,
  step,
}: {
  form: BookingEditorState;
  setForm: React.Dispatch<React.SetStateAction<BookingEditorState>>;
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
                      customFields: f.customFields.map((x) =>
                        x.id === field.id ? { ...x, label: e.target.value } : x,
                      ),
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
                        customFields: f.customFields.map((x) =>
                          x.id === field.id ? { ...x, required: e.target.checked } : x,
                        ),
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

function AccordionPanel({ icon, title, open, onToggle, children }: {
  icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; children?: React.ReactNode;
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

function IconSlidersGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h7M15 8h5M4 16h5M13 16h7" />
      <circle cx="13" cy="8" r="2" />
      <circle cx="11" cy="16" r="2" />
    </svg>
  );
}

export function BookingEditor({
  initial,
  onSaved,
}: {
  initial: BookingEditorState;
  onSaved: (id: string) => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<BookingEditorState>(initial);
  const [tab, setTab] = useState<EditorTab>('thumbnail');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [openOption, setOpenOption] = useState<string | null>('email');
  const [priceProUnlocked, setPriceProUnlocked] = useState(false);
  const [descRef, setDescRef] = useState<HTMLTextAreaElement | null>(null);
  const [savedNote, setSavedNote] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const sign = useCallback(
    (kind: SignKind) =>
      authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        '/api/cloudinary/sign-upload', { method: 'POST', body: { kind } },
      ),
    [authedRequest],
  );

  function patch<K extends keyof BookingEditorState>(key: K, value: BookingEditorState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const { open: openMediaLibrary } = useMediaLibrary();

  function pickCover() {
    openMediaLibrary({
      accept: 'image',
      kind: 'product_cover',
      title: 'Select an image',
      onSelect: (m) => {
        patch('coverImageUrl', m.url);
        patch('coverPublicId', m.publicId);
        setUploadNote('');
      },
    });
  }

  // Direct upload kept for drag-and-drop; also records into the media library.
  async function handleCoverFile(file: File) {
    try {
      const res = await uploadAndRecord(file, 'product_cover', sign, authedRequest);
      patch('coverImageUrl', res.url);
      patch('coverPublicId', res.publicId);
      setUploadNote('');
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) void handleCoverFile(file);
  }

  function buildBody() {
    const weeklyWindows = Object.entries(form.weeklySchedule)
      .filter(([, s]) => s.enabled)
      .flatMap(([d, s]) =>
        s.slots.map((slot) => ({
          weekday: Number(d),
          startMinute: timeToMinutes(slot.start),
          endMinute: timeToMinutes(slot.end),
        })),
      );
    return {
      title: form.title,
      description: form.description,
      shortDescription: form.shortDescription,
      bottomTitle: form.bottomTitle,
      ctaLabel: form.ctaLabel,
      thumbnailButtonLabel: form.thumbnailButtonLabel,
      coverImageUrl: form.coverImageUrl,
      coverPublicId: form.coverPublicId,
      thumbnailStyle: form.thumbnailStyle,
      priceCents: Math.round(parseFloat(form.priceDollars || '0') * 100),
      discountPriceCents: form.discountEnabled && form.discountPriceDollars
        ? Math.round(parseFloat(form.discountPriceDollars) * 100) : 0,
      discountEnabled: form.discountEnabled,
      durationMin: form.durationMin,
      timezone: form.timezone,
      calendarLabel: form.calendarLabel,
      minNoticeMin: Math.round(parseFloat(form.minNoticeHours || '12') * 60),
      maxHorizonDays: parseInt(form.maxHorizonDays || '60', 10),
      maxAttendees: parseInt(form.maxAttendees || '1', 10),
      bufferBeforeEnabled: form.bufferBeforeEnabled,
      bufferAfterEnabled: form.bufferAfterEnabled,
      bufferBeforeMin: form.bufferBeforeEnabled ? form.bufferBeforeMin : 0,
      bufferAfterMin: form.bufferAfterEnabled ? form.bufferAfterMin : 0,
      meetingUrl: form.meetingUrl || undefined,
      weeklyWindows,
      intakeQuestions: form.customFields.map((f) => f.label).filter(Boolean),
      confirmSubject: form.confirmSubject,
      confirmBody: form.confirmBody,
    };
  }

  async function save(publish: boolean) {
    setError('');
    setBusy(true);
    try {
      let id = form.id;
      const body = buildBody();
      if (id) {
        await authedRequest(`/api/booking-types/${id}`, { method: 'PATCH', body });
      } else {
        const res = await authedRequest<{ bookingType: { id: string } }>('/api/booking-types', { method: 'POST', body });
        id = res.bookingType.id;
        setForm((f) => ({ ...f, id }));
      }
      if (publish && id) {
        await authedRequest(`/api/booking-types/${id}/publish`, { method: 'POST' });
        onSaved(id!);
      } else {
        setSavedNote('Draft saved');
        setTimeout(() => setSavedNote(''), 3000);
      }
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save booking type');
    } finally {
      setBusy(false);
    }
  }

  const tabOrder: EditorTab[] = ['thumbnail', 'checkout', 'availability', 'options'];
  function nextTab() {
    const i = tabOrder.indexOf(tab);
    if (i >= 0 && i < tabOrder.length - 1) setTab(tabOrder[i + 1]!);
  }

  const tabs: { value: EditorTab; label: string; icon: React.ReactNode }[] = [
    { value: 'thumbnail', label: 'Thumbnail', icon: <IconImage size={16} /> },
    { value: 'checkout', label: 'Checkout Page', icon: <IconCartGlyph size={16} /> },
    { value: 'availability', label: 'Availability', icon: <IconCalendarGlyph size={16} /> },
    { value: 'options', label: 'Options', icon: <IconSlidersGlyph size={16} /> },
  ];

  const previewCalendarMode =
    tab === 'availability' || tab === 'options' ? ('full' as const) : tab === 'checkout' ? ('strip' as const) : ('none' as const);
  const showPreviewForm = tab === 'checkout' || tab === 'availability' || tab === 'options';
  const showPreviewTotal = tab === 'checkout' || tab === 'availability' || tab === 'options';

  return (
    <div className={cn('product-editor', tab === 'options' && 'product-editor--options')}>
      <EditorTopBar title={form.id ? 'Edit Booking' : 'Add New Booking'} />
      <div className="pe-layout">
        <div className="pe-main min-w-0">
          <div className="mb-8 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button key={t.value} type="button" onClick={() => setTab(t.value)}
                className={cn('pe-tab', tab === t.value && 'pe-tab--active')}>
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
                    <button key={style} type="button" onClick={() => patch('thumbnailStyle', style)}
                      className={cn('pe-style-card', form.thumbnailStyle === style && 'pe-style-card--active')}>
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
                        <IconCalendarGlyph size={36} />
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
                  <CharField label="Title" value={form.title} onChange={(v) => patch('title', v)} max={50} />
                  <CharField label="Subtitle" value={form.shortDescription} onChange={(v) => patch('shortDescription', v)} max={100} />
                  <CharField label="Button" required value={form.thumbnailButtonLabel} onChange={(v) => patch('thumbnailButtonLabel', v)} max={30} />
                </div>
              </section>
            </div>
          )}

          {tab === 'checkout' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Select Image" />
                <div className="pe-section-inner pe-upload-row">
                  <div className="relative shrink-0">
                    {form.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.coverImageUrl} alt="" className="h-[88px] w-[130px] rounded-[10px] object-cover" />
                    ) : (
                      <div className="flex h-[88px] w-[130px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8]">
                        <IconCalendarGlyph size={32} />
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
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleCoverDrop}
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
                <Step n={2} label="Write Description" />
                <div className="pe-section-inner space-y-4">
                  <CharField label="Title" required value={form.title} onChange={(v) => patch('title', v)} max={140} />
                  <div>
                    <label className="mb-1.5 block pe-field-label">Description Body<span className="pe-field-req">*</span></label>
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
                        <DescToolbarBtn title="Numbered list" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}1. `)}>
                          <span className="text-[10px] font-bold">1.</span>
                        </DescToolbarBtn>
                        <DescToolbarBtn title="Insert image" onClick={() => patch('description', `${form.description}${form.description ? '\n' : ''}[image url]`)}>
                          <IconImage size={14} />
                        </DescToolbarBtn>
                        <button
                          type="button"
                          onClick={() => patch('description', generateCoachingDescription(form.title))}
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
                        placeholder="Describe your coaching session..."
                      />
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
                      <label className="mb-1.5 block pe-field-label">Price($)<span className="pe-field-req">*</span></label>
                      <input value={form.priceDollars} onChange={(e) => patch('priceDollars', e.target.value)} className="pe-input-outline" inputMode="decimal" />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <label className="pe-field-label">Discount Price($)</label>
                        <Toggle on={form.discountEnabled} onChange={(v) => patch('discountEnabled', v)} />
                      </div>
                      <input disabled={!form.discountEnabled} value={form.discountPriceDollars}
                        onChange={(e) => patch('discountPriceDollars', e.target.value)} className="pe-input" placeholder="0" />
                    </div>
                  </div>
                  {!priceProUnlocked && (
                    <div className="pe-locked-box">
                      <div className="pe-locked-blur space-y-3">
                        {['Add Payment Plan', 'Add Discount Code', 'Limit Quantity'].map((l) => (
                          <div key={l} className="flex items-center gap-3 text-sm text-[#6b7280]">
                            <IconLock size={14} className="shrink-0 text-[#9ca3af]" />{l}
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

          {tab === 'availability' && (
            <div>
              <section className="pe-section">
                <Step n={1} label="Configure settings" />
                <div className="pe-section-inner space-y-4">
                  <div>
                    <label className="mb-1.5 block pe-field-label">Calendar</label>
                    <select value={form.calendarLabel} onChange={(e) => patch('calendarLabel', e.target.value)} className="pe-input-outline">
                      <option value="Default">Default</option>
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block pe-field-label">Time Zone</label>
                      <select value={form.timezone} onChange={(e) => patch('timezone', e.target.value)} className="pe-input-outline">
                        {BOOKING_TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block pe-field-label">Duration (min)</label>
                      <select value={form.durationMin} onChange={(e) => patch('durationMin', parseInt(e.target.value, 10))} className="pe-input-outline">
                        {DURATION_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Prevent Booking within X hours of Current Time</label>
                    <div className="flex items-center gap-2">
                      <input value={form.minNoticeHours} onChange={(e) => patch('minNoticeHours', e.target.value)} className="pe-input-outline max-w-[120px]" type="number" min={0} />
                      <span className="text-sm text-[#6b7280]">Hours</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Max Attendees</label>
                    <p className="mb-2 text-xs text-[#8b8d98]">Host a group call by letting 1+ attendees join the meeting.</p>
                    <div className="flex items-center gap-2">
                      <input value={form.maxAttendees} onChange={(e) => patch('maxAttendees', e.target.value)} className="pe-input-outline max-w-[120px]" type="number" min={1} />
                      <span className="text-sm text-[#6b7280]">Attendees</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 pe-field-label">Break Between Meetings</p>
                    <p className="mb-3 text-xs text-[#8b8d98]">Take some buffer time for you to prepare or wrap up for the next meeting</p>
                    {(['Before Meeting', 'After Meeting'] as const).map((label, idx) => {
                      const enabledKey = idx === 0 ? 'bufferBeforeEnabled' : 'bufferAfterEnabled';
                      const minKey = idx === 0 ? 'bufferBeforeMin' : 'bufferAfterMin';
                      const enabled = form[enabledKey];
                      return (
                        <div key={label} className="mb-3 flex flex-wrap items-center gap-3">
                          <Toggle on={enabled} onChange={(v) => patch(enabledKey, v)} />
                          <span className="text-sm font-medium text-[#1a1a2e]">{label}</span>
                          <select disabled={!enabled} value={form[minKey]}
                            onChange={(e) => patch(minKey, parseInt(e.target.value, 10))}
                            className="rounded-lg border border-[#e4e5eb] px-3 py-2 text-sm disabled:opacity-50">
                            {BUFFER_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Book within the Next</label>
                    <div className="flex items-center gap-2">
                      <input value={form.maxHorizonDays} onChange={(e) => patch('maxHorizonDays', e.target.value)} className="pe-input-outline max-w-[120px]" type="number" min={1} />
                      <span className="text-sm text-[#6b7280]">Days</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block pe-field-label">Meeting link<span className="pe-field-req">*</span></label>
                    <input value={form.meetingUrl} onChange={(e) => patch('meetingUrl', e.target.value)} placeholder="https://meet.google.com/…" className="pe-input-outline" />
                    {!form.meetingUrl && <p className="pe-hint-warn mt-1.5">Required before you can publish</p>}
                  </div>
                </div>
              </section>
              <section className="pe-section">
                <Step n={2} label="Select available times" />
                <div className="pe-section-inner space-y-3">
                  <p className="pe-field-label">Your Availability<span className="pe-field-req">*</span></p>
                  {WEEKDAY_LABELS.map((day, i) => {
                    const s = form.weeklySchedule[i]!;
                    return (
                      <div key={day} className="pe-avail-row">
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({
                            ...f,
                            weeklySchedule: {
                              ...f.weeklySchedule,
                              [i]: { ...s, enabled: !s.enabled },
                            },
                          }))}
                          className={cn('pe-avail-day', s.enabled ? 'pe-avail-day--on' : 'pe-avail-day--off')}
                        >
                          {day}
                        </button>
                        {s.enabled && s.slots.map((slot, slotIdx) => (
                          <div key={slot.id} className="pe-avail-slot">
                            <span className="text-xs text-[#6b7280]">From</span>
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => setForm((f) => ({
                                ...f,
                                weeklySchedule: {
                                  ...f.weeklySchedule,
                                  [i]: {
                                    ...s,
                                    slots: s.slots.map((sl, j) =>
                                      j === slotIdx ? { ...sl, start: e.target.value } : sl,
                                    ),
                                  },
                                },
                              }))}
                              className="pe-avail-time"
                            />
                            <span className="text-xs text-[#6b7280]">to</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => setForm((f) => ({
                                ...f,
                                weeklySchedule: {
                                  ...f.weeklySchedule,
                                  [i]: {
                                    ...s,
                                    slots: s.slots.map((sl, j) =>
                                      j === slotIdx ? { ...sl, end: e.target.value } : sl,
                                    ),
                                  },
                                },
                              }))}
                              className="pe-avail-time"
                            />
                            <button
                              type="button"
                              title="Add time slot"
                              onClick={() => setForm((f) => ({
                                ...f,
                                weeklySchedule: {
                                  ...f.weeklySchedule,
                                  [i]: {
                                    ...s,
                                    slots: [...s.slots, { id: uid(), start: '09:00', end: '17:00' }],
                                  },
                                },
                              }))}
                              className="pe-icon-btn"
                            >
                              <IconPlus size={16} />
                            </button>
                            {s.slots.length > 1 && (
                              <button
                                type="button"
                                title="Remove time slot"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  weeklySchedule: {
                                    ...f.weeklySchedule,
                                    [i]: {
                                      ...s,
                                      slots: s.slots.filter((_, j) => j !== slotIdx),
                                    },
                                  },
                                }))}
                                className="pe-icon-btn pe-icon-btn--danger"
                              >
                                <IconTrash size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  <button type="button" className="pe-link-accent mt-2 inline-flex items-center gap-1">
                    <IconCalendar size={14} /> Block off specific dates →
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === 'options' && (
            <div className="space-y-3">
              <AccordionPanel icon={<IconMail size={18} />} title="Email Flows" open={openOption === 'email'} onToggle={() => setOpenOption(openOption === 'email' ? null : 'email')}>
                <p className="mb-3 text-xs text-[#8b8d98]">Automated follow-up emails after booking.</p>
                <div className="space-y-4">
                  {form.emailFlows.map((step) => (
                    <div key={step.id} className="rounded-xl border border-[#e4e5eb] bg-[#fafafa] p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
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
                            className="rounded border-[#e4e5eb] accent-[#6355fa]"
                          />
                          Send after
                        </label>
                        <input
                          type="number"
                          min={0}
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
                            emailFlows: f.emailFlows.map((x) =>
                              x.id === step.id ? { ...x, subject: e.target.value } : x,
                            ),
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
                            emailFlows: f.emailFlows.map((x) =>
                              x.id === step.id ? { ...x, body: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="Email body"
                        rows={3}
                        className="pe-textarea mt-2 resize-y min-h-[80px]"
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
                          subject: 'Following up on your call',
                          body: 'Thanks again for booking — let me know if you have any questions before our session!',
                          enabled: true,
                        },
                      ],
                    }))
                  }
                  className="pe-add-link mt-2"
                >
                  + Add email step
                </button>
              </AccordionPanel>
              <AccordionPanel icon={<IconMail size={18} />} title="Confirmation Email" open={openOption === 'confirm'} onToggle={() => setOpenOption(openOption === 'confirm' ? null : 'confirm')}>
                <CharField label="Subject" value={form.confirmSubject} onChange={(v) => patch('confirmSubject', v)} max={200} />
                <div className="mt-4">
                  <CharField label="Body" value={form.confirmBody} onChange={(v) => patch('confirmBody', v)} max={5000} multiline rows={5} />
                </div>
                <button type="button" onClick={() => { patch('confirmSubject', DEFAULT_CONFIRM_SUBJECT); patch('confirmBody', DEFAULT_CONFIRM_BODY); }}
                  className="pe-add-link mt-2">Restore Default</button>
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
                <button type="button" disabled={busy} onClick={nextTab} className="pe-btn-solid disabled:opacity-50">Next</button>
              ) : (
                <button type="button" disabled={busy} onClick={() => void save(true)} className="pe-btn-solid disabled:opacity-50">Publish</button>
              )}
            </div>
          </div>
        </div>

        <div className="pe-preview-col">
          {tab === 'thumbnail' ? (
            <div className="pe-preview-thumb"><ThumbnailPreviewCard form={form} /></div>
          ) : (
            <div className="pe-phone-wrap">
              <PhoneFrame>
                <BookingPhonePreview
                  form={form}
                  showHeroBack={tab === 'checkout'}
                  calendarMode={previewCalendarMode}
                  showFormFields={showPreviewForm}
                  showTotal={showPreviewTotal}
                />
              </PhoneFrame>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
