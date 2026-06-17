'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Alert } from '@/components/ui';
import { PhoneFrame } from '@/components/stan/PhoneFrame';
import { IconArrowLeft, IconList, IconPlay, IconTrash, IconUpload } from '@/components/icons';
import { uploadAndRecord, type SignKind } from '@/lib/upload';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { cn } from '@/lib/cn';

const DEFAULT_LESSON_DESCRIPTION =
  "In this lesson, you'll learn:\n• Key takeaway #1\n• Key takeaway #2\n• Key takeaway #3";

interface LessonView {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  type: 'video' | 'text' | 'download';
  preview: boolean;
  status: 'draft' | 'published';
  textContent: string;
  videoPublicId: string;
  videoUrl: string;
  assetPublicId: string;
  assetResourceType: 'raw' | 'video' | 'image';
  assetFilename: string;
  durationSec: number;
}

interface LessonResponse {
  lesson: LessonView;
  course: { id: string; title: string; slug: string; highlightColor?: string };
  module: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
}

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

function LessonPreview({
  title,
  description,
  highlightColor,
  nextLessonTitle,
}: {
  title: string;
  description: string;
  highlightColor: string;
  nextLessonTitle?: string;
}) {
  const lines = description.split('\n').filter(Boolean).slice(0, 4);
  return (
    <div className="min-h-full bg-[#f7f8fc] px-4 pb-5 pt-3 text-[#1a1a2e]">
      <div className="rounded-2xl bg-white p-4 shadow-[0_10px_24px_-16px_rgba(15,15,25,0.55)]">
        <h3 className="text-base font-bold leading-snug" style={{ color: highlightColor }}>
          {title || 'Lesson title'}
        </h3>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-[#50535f]">
          {lines.length ? (
            lines.map((line, i) => {
              const bullet = line.trimStart().startsWith('•') || /^\d+\.\s/.test(line.trimStart());
              const clean = line.replace(/^[\s•\-]+/, '').replace(/^\d+\.\s/, '');
              return (
                <p key={`${line}-${i}`} className={bullet ? 'flex gap-2' : ''}>
                  {bullet && <span style={{ color: highlightColor }}>•</span>}
                  <span>{clean}</span>
                </p>
              );
            })
          ) : (
            <p>No lesson description yet.</p>
          )}
        </div>
      </div>

      {nextLessonTitle && (
        <div className="mt-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Next Lesson</p>
          <p className="mt-1 text-xs font-semibold text-[#111827]">{nextLessonTitle}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#e5e7eb] bg-white p-2 text-[10px] text-[#7a7f8f]">
        <div className="rounded-lg bg-[#f3f4f6] py-1 text-center">Overview</div>
        <div className="rounded-lg bg-[#f3f4f6] py-1 text-center">Lessons</div>
        <div className="rounded-lg bg-[#f3f4f6] py-1 text-center">Resources</div>
      </div>
    </div>
  );
}

export function CourseLessonBuilder({
  courseId,
  lessonId,
  onBack,
}: {
  courseId: string;
  lessonId: string;
  onBack: () => void;
}) {
  const { authedRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [highlightColor, setHighlightColor] = useState('#2563eb');
  const [nextLessonTitle, setNextLessonTitle] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(DEFAULT_LESSON_DESCRIPTION);
  const [videoPublicId, setVideoPublicId] = useState('');
  const [assetPublicId, setAssetPublicId] = useState('');
  const [assetResourceType, setAssetResourceType] = useState<'raw' | 'video' | 'image'>('raw');
  const [assetFilename, setAssetFilename] = useState('');
  const [descRef, setDescRef] = useState<HTMLTextAreaElement | null>(null);

  const sign = useCallback(
    (kind: SignKind) =>
      authedRequest<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        '/api/cloudinary/sign-upload',
        { method: 'POST', body: { kind } },
      ),
    [authedRequest],
  );

  const loadLesson = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authedRequest<LessonResponse>(`/api/courses/lessons/${lessonId}`);
      if (res.lesson.courseId !== courseId) {
        setError('This lesson does not belong to the selected course.');
      }
      setCourseTitle(res.course.title);
      setHighlightColor(res.course.highlightColor || '#2563eb');
      setNextLessonTitle(res.nextLesson?.title || '');
      setTitle(res.lesson.title);
      setDescription(res.lesson.textContent || DEFAULT_LESSON_DESCRIPTION);
      setVideoPublicId(res.lesson.videoPublicId || '');
      setAssetPublicId(res.lesson.assetPublicId || '');
      setAssetResourceType(res.lesson.assetResourceType || 'raw');
      setAssetFilename(res.lesson.assetFilename || '');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  }, [authedRequest, courseId, lessonId]);

  useEffect(() => {
    void loadLesson();
  }, [loadLesson]);

  const { open: openMediaLibrary } = useMediaLibrary();

  function pickVideo() {
    openMediaLibrary({
      accept: 'file',
      kind: 'course_video',
      title: 'Select a video',
      onSelect: (m) => {
        setVideoPublicId(m.publicId);
        setNote('Video attached');
      },
    });
  }

  function pickMaterial() {
    openMediaLibrary({
      accept: 'file',
      kind: 'product_file',
      title: 'Select a file',
      onSelect: (m) => {
        setAssetPublicId(m.publicId);
        setAssetResourceType(m.resourceType === 'video' ? 'video' : 'raw');
        setAssetFilename(m.filename);
        setNote(`Material attached: ${m.filename}`);
      },
    });
  }

  // Direct uploads kept for drag-and-drop; also record into the media library.
  async function uploadVideo(file: File) {
    try {
      const uploaded = await uploadAndRecord(file, 'course_video', sign, authedRequest);
      setVideoPublicId(uploaded.publicId);
      setNote('Video attached');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Video upload failed');
    }
  }

  async function uploadMaterial(file: File) {
    try {
      const uploaded = await uploadAndRecord(file, 'product_file', sign, authedRequest);
      setAssetPublicId(uploaded.publicId);
      setAssetResourceType('raw');
      setAssetFilename(uploaded.filename);
      setNote(`Material attached: ${uploaded.filename}`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Material upload failed');
    }
  }

  async function save(status: 'draft' | 'published') {
    setBusy(true);
    setError('');
    try {
      await authedRequest(`/api/courses/lessons/${lessonId}`, {
        method: 'PATCH',
        body: {
          title: title.trim(),
          type: 'video',
          status,
          textContent: description,
          videoPublicId,
          assetPublicId,
          assetResourceType,
          assetFilename,
        },
      });
      setNote(status === 'published' ? 'Lesson published' : 'Draft saved');
      await loadLesson();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save lesson');
    } finally {
      setBusy(false);
    }
  }

  async function removeLesson() {
    if (!confirm('Delete this lesson?')) return;
    setBusy(true);
    setError('');
    try {
      await authedRequest(`/api/courses/lessons/${lessonId}`, { method: 'DELETE' });
      onBack();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not delete lesson');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-editor">
      <div className="pe-layout">
        <div className="pe-main min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] hover:text-[#1a1a2e]"
          >
            <IconArrowLeft size={16} />
            Course Builder
          </button>
          {courseTitle && <p className="mb-5 text-xs text-[#8b8d98]">{courseTitle}</p>}

          {error && <Alert kind="error" className="mb-4">{error}</Alert>}
          {note && <Alert kind="info" className="mb-4">{note}</Alert>}

          {loading ? (
            <div className="rounded-xl border border-[#e4e5eb] bg-[#fafafa] p-6 text-sm text-[#6b7280]">Loading lesson...</div>
          ) : (
            <>
              <section className="pe-section">
                <SectionTitle n={1} label="Video" />
                <div className="pe-section-inner">
                  <div
                    className={cn('pe-file-drop', videoPublicId && 'border-[#6355fa] bg-[#f5f4ff]')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) void uploadVideo(file);
                    }}
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#8b8d98]">
                      <IconPlay size={20} />
                    </div>
                    <p className="text-sm font-medium text-[#3d3d4a]">
                      {videoPublicId ? 'Video uploaded' : 'Drag and drop your lesson video'}
                    </p>
                    <button type="button" onClick={pickVideo} className="pe-btn-outline mt-1 cursor-pointer">
                      Select Video
                    </button>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <SectionTitle n={2} label="Lesson Details" />
                <div className="pe-section-inner space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="pe-field-label">
                        Lesson Title
                        <span className="pe-field-req">*</span>
                      </label>
                      <span className="pe-char-count">{title.length}/100</span>
                    </div>
                    <input
                      maxLength={100}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="pe-input"
                      placeholder="Name your lesson..."
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
                            setDescription(next);
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
                            setDescription(next);
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
                          onClick={() => setDescription(`${description}${description ? '\n' : ''}• `)}
                        >
                          <IconList size={14} />
                        </DescToolbarBtn>
                        <DescToolbarBtn
                          title="Numbered list"
                          onClick={() => setDescription(`${description}${description ? '\n' : ''}1. `)}
                        >
                          <span className="text-[10px] font-bold">1.</span>
                        </DescToolbarBtn>
                        <button
                          type="button"
                          className="pe-toolbar-ai inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-white"
                          onClick={() => void save('draft')}
                          disabled={busy}
                        >
                          Save
                        </button>
                      </div>
                      <textarea
                        ref={setDescRef}
                        rows={8}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="pe-desc-area"
                        placeholder={DEFAULT_LESSON_DESCRIPTION}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <SectionTitle n={3} label="Supporting Materials" />
                <div className="pe-section-inner">
                  <div
                    className={cn('pe-file-drop', assetFilename && 'border-[#6355fa] bg-[#f5f4ff]')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) void uploadMaterial(file);
                    }}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#8b8d98]">
                      <IconUpload size={18} />
                    </div>
                    <p className="text-sm font-medium text-[#3d3d4a]">
                      {assetFilename ? assetFilename : 'Drag and drop worksheets or files'}
                    </p>
                    <button type="button" onClick={pickMaterial} className="pe-btn-outline mt-1 cursor-pointer">
                      Upload
                    </button>
                  </div>
                </div>
              </section>

              <p className="pe-footer-note">Improve this page</p>
              <div className="pe-footer-actions justify-between">
                <button type="button" className="pe-btn-outline !border-[#ef4444] !text-[#ef4444]" onClick={removeLesson} disabled={busy}>
                  <IconTrash size={14} />
                  Delete
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" className="pe-btn-outline" onClick={() => void save('draft')} disabled={busy}>
                    Save As Draft
                  </button>
                  <button type="button" className="pe-btn-solid" onClick={() => void save('published')} disabled={busy}>
                    Publish
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="pe-phone-wrap">
          <PhoneFrame contentClassName="pt-0">
            <LessonPreview
              title={title}
              description={description}
              highlightColor={highlightColor || '#2563eb'}
              nextLessonTitle={nextLessonTitle}
            />
          </PhoneFrame>
        </aside>
      </div>
    </div>
  );
}
