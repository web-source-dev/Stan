'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { IconImage, IconList, IconPencil } from '@/components/icons';
import { uploadAndRecord, type SignKind } from '@/lib/upload';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import {
  COURSE_ACCENT_PRESETS,
  COURSE_BG_PRESETS,
  COURSE_TITLE_FONTS,
  type CourseEditorState,
} from '@/lib/course-types';
import { cn } from '@/lib/cn';

type HomepageState = Pick<
  CourseEditorState,
  | 'homepageTitle'
  | 'homepageDescription'
  | 'homepageCoverImageUrl'
  | 'homepageCoverPublicId'
  | 'titleFont'
  | 'backgroundColor'
  | 'highlightColor'
>;

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  return { next, cursor: start + before.length + selected.length + after.length };
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

function SectionTitle({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="pe-step-badge">{n}</span>
      <span className="pe-step-label">{label}</span>
    </div>
  );
}

function renderMarkdownLine(line: string, key: number, bulletColor: string) {
  const trimmed = line.trimStart();
  const bullet = trimmed.startsWith('•') || trimmed.startsWith('-');
  const numbered = /^\d+\.\s/.test(trimmed);
  const text = line.replace(/^[\s•\-]+/, '').replace(/^\d+\.\s/, '').trim();
  const chunks = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
  const content =
    chunks.length > 0
      ? chunks.map((chunk, idx) => {
          if (chunk.startsWith('**') && chunk.endsWith('**')) {
            return (
              <strong key={idx} className="font-semibold text-[#1a1a2e]">
                {chunk.slice(2, -2)}
              </strong>
            );
          }
          if (chunk.startsWith('_') && chunk.endsWith('_')) {
            return (
              <em key={idx} className="italic">
                {chunk.slice(1, -1)}
              </em>
            );
          }
          return <span key={idx}>{chunk}</span>;
        })
      : text;

  if (bullet || numbered) {
    return (
      <p key={key} className="flex gap-2">
        <span className="shrink-0 font-semibold" style={{ color: bulletColor }}>
          {numbered ? `${trimmed.match(/^\d+/)?.[0]}.` : '•'}
        </span>
        <span>{content}</span>
      </p>
    );
  }
  return <p key={key}>{content || <>&nbsp;</>}</p>;
}

function sanitizeHex(input: string) {
  const compact = input.replace(/\s+/g, '');
  if (!compact) return '#';
  return compact.startsWith('#') ? compact : `#${compact}`;
}

function CourseHomepagePreview({ form }: { form: HomepageState }) {
  const textLines = (form.homepageDescription || '').split('\n');
  return (
    <div
      className="min-h-full px-4 pb-6 pt-2 text-[#1a1a2e]"
      style={{ backgroundColor: form.backgroundColor || '#f3f6fd', fontFamily: form.titleFont || 'inherit' }}
    >
      <div className="rounded-2xl bg-white p-3 shadow-[0_10px_22px_-14px_rgba(15,15,25,0.45)]">
        {form.homepageCoverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.homepageCoverImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />
        ) : (
          <div className="grid aspect-video w-full place-items-center rounded-xl bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8] text-[#9aa0b3]">
            <IconImage size={26} />
          </div>
        )}
        <h3 className="mt-3 text-base font-bold leading-snug" style={{ color: form.highlightColor || '#6355FF' }}>
          {form.homepageTitle || 'Course homepage title'}
        </h3>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-[#50535f]">
          {textLines.map((line, i) => renderMarkdownLine(line, i, form.highlightColor || '#6355FF'))}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl px-4 py-2.5 text-xs font-bold text-white"
          style={{ backgroundColor: form.highlightColor || '#6355FF' }}
        >
          GET STARTED
        </button>
      </div>
    </div>
  );
}

export function CourseHomepageEditor({
  courseId,
  initial,
  onSaved,
  onCancel,
}: {
  courseId: string;
  initial: HomepageState;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<HomepageState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [descRef, setDescRef] = useState<HTMLTextAreaElement | null>(null);

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

  function patch<K extends keyof HomepageState>(key: K, value: HomepageState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const { open: openMediaLibrary } = useMediaLibrary();

  function pickCover() {
    openMediaLibrary({
      accept: 'image',
      kind: 'course_cover',
      title: 'Select an image',
      onSelect: (m) => {
        setForm((prev) => ({ ...prev, homepageCoverImageUrl: m.url, homepageCoverPublicId: m.publicId }));
        setUploadNote('');
      },
    });
  }

  // Direct upload kept for drag-and-drop; also records into the media library.
  async function uploadCoverFile(file: File) {
    try {
      const res = await uploadAndRecord(file, 'course_cover', sign, authedRequest);
      setForm((prev) => ({
        ...prev,
        homepageCoverImageUrl: res.url,
        homepageCoverPublicId: res.publicId,
      }));
      setUploadNote('');
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    setSavedNote('');
    try {
      await authedRequest(`/api/courses/${courseId}`, {
        method: 'PATCH',
        body: {
          homepageTitle: form.homepageTitle.trim(),
          homepageDescription: form.homepageDescription,
          homepageCoverImageUrl: form.homepageCoverImageUrl,
          homepageCoverPublicId: form.homepageCoverPublicId,
          titleFont: form.titleFont,
          backgroundColor: form.backgroundColor,
          highlightColor: form.highlightColor,
        },
      });
      setSavedNote('Homepage saved');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save homepage');
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
            <SectionTitle n={1} label="Page Description" />
            <div className="pe-section-inner space-y-4">
              <div className="pe-upload-row">
                <div className="relative shrink-0">
                  {form.homepageCoverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.homepageCoverImageUrl} alt="" className="h-[88px] w-[130px] rounded-[10px] object-cover" />
                  ) : (
                    <div className="grid h-[88px] w-[130px] place-items-center rounded-[10px] bg-gradient-to-br from-[#e8ecf4] to-[#d4dae8] text-[#9aa0b3]">
                      <IconImage size={26} />
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
                  className="pe-upload-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void uploadCoverFile(file);
                  }}
                >
                  <p className="text-sm font-medium text-[#3d3d4a]">Drag your image here</p>
                  <p className="mt-1 text-xs text-[#8b8d98]">1920 x 1080 recommended</p>
                  <button type="button" onClick={pickCover} className="pe-btn-outline mt-3 cursor-pointer">
                    Select Image
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="pe-field-label">
                    Homepage Title
                    <span className="pe-field-req">*</span>
                  </label>
                  <span className="pe-char-count">{form.homepageTitle.length}/100</span>
                </div>
                <input
                  maxLength={100}
                  value={form.homepageTitle}
                  onChange={(e) => patch('homepageTitle', e.target.value)}
                  className="pe-input"
                  placeholder="My 12-week Program"
                />
              </div>

              <div>
                <label className="mb-1.5 block pe-field-label">
                  Description
                  <span className="pe-field-req">*</span>
                </label>
                <div className="pe-desc-box">
                  <div className="pe-toolbar">
                    <DescToolbarBtn
                      title="Bold"
                      onClick={() => {
                        if (!descRef) return;
                        const { next, cursor } = wrapSelection(descRef, '**');
                        patch('homepageDescription', next);
                        requestAnimationFrame(() => {
                          descRef.focus();
                          descRef.setSelectionRange(cursor, cursor);
                        });
                      }}
                    >
                      <span className="text-xs font-bold">B</span>
                    </DescToolbarBtn>
                    <DescToolbarBtn
                      title="Italic"
                      onClick={() => {
                        if (!descRef) return;
                        const { next, cursor } = wrapSelection(descRef, '_');
                        patch('homepageDescription', next);
                        requestAnimationFrame(() => {
                          descRef.focus();
                          descRef.setSelectionRange(cursor, cursor);
                        });
                      }}
                    >
                      <span className="text-xs italic">I</span>
                    </DescToolbarBtn>
                    <span className="mx-0.5 h-4 w-px bg-[#e4e5eb]" />
                    <DescToolbarBtn
                      title="Bullet list"
                      onClick={() =>
                        patch(
                          'homepageDescription',
                          `${form.homepageDescription}${form.homepageDescription ? '\n' : ''}• `,
                        )
                      }
                    >
                      <IconList size={14} />
                    </DescToolbarBtn>
                    <DescToolbarBtn
                      title="Numbered list"
                      onClick={() =>
                        patch(
                          'homepageDescription',
                          `${form.homepageDescription}${form.homepageDescription ? '\n' : ''}1. `,
                        )
                      }
                    >
                      <span className="text-[10px] font-bold">1.</span>
                    </DescToolbarBtn>
                  </div>
                  <textarea
                    ref={setDescRef}
                    rows={8}
                    value={form.homepageDescription}
                    onChange={(e) => patch('homepageDescription', e.target.value)}
                    className="pe-desc-area"
                    placeholder="Describe what students will learn..."
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="pe-section">
            <SectionTitle n={2} label="Customize Branding" />
            <div className="pe-section-inner space-y-4">
              <div>
                <label className="mb-1.5 block pe-field-label">Title Font</label>
                <select
                  value={form.titleFont}
                  onChange={(e) => patch('titleFont', e.target.value)}
                  className="pe-input-outline"
                >
                  {COURSE_TITLE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block pe-field-label">Background Color</label>
                <input
                  value={form.backgroundColor}
                  onChange={(e) => patch('backgroundColor', sanitizeHex(e.target.value))}
                  className="pe-input-outline"
                  placeholder="#f3f6fd"
                />
                <div className="flex flex-wrap gap-2">
                  {COURSE_BG_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      onClick={() => patch('backgroundColor', color)}
                      className={cn(
                        'h-7 w-7 rounded-full border transition',
                        form.backgroundColor.toLowerCase() === color.toLowerCase()
                          ? 'border-[#111827] ring-2 ring-[#111827]/20'
                          : 'border-[#d1d5db]',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block pe-field-label">Highlight Color</label>
                <input
                  value={form.highlightColor}
                  onChange={(e) => patch('highlightColor', sanitizeHex(e.target.value))}
                  className="pe-input-outline"
                  placeholder="#6355FF"
                />
                <div className="flex flex-wrap gap-2">
                  {COURSE_ACCENT_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      onClick={() => patch('highlightColor', color)}
                      className={cn(
                        'h-7 w-7 rounded-full border transition',
                        form.highlightColor.toLowerCase() === color.toLowerCase()
                          ? 'border-[#111827] ring-2 ring-[#111827]/20'
                          : 'border-[#d1d5db]',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="pe-footer-actions justify-between">
            <button type="button" className="pe-btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="pe-btn-solid" onClick={save} disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <aside className="pe-phone-wrap">
          <PhoneFrame contentClassName="pt-0">
            <CourseHomepagePreview form={form} />
          </PhoneFrame>
        </aside>
      </div>
    </div>
  );
}
