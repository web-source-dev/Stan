'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, Card, Field, Textarea, Alert, Badge, EmptyState, Skeleton, SectionHeading, Segmented } from '@/components/ui';
import {
  IconPlus, IconBook, IconArrowLeft, IconEye, IconPlay, IconDownload, IconTrash, IconUpload,
  IconChevronDown, IconImage, IconCheck,
} from '@/components/icons';
import { uploadToCloudinary, type SignKind } from '@/lib/upload';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Course { id: string; title: string; slug: string; shortDescription: string; description: string; priceCents: number; currency: string; coverImageUrl: string; status: string; enrollmentCount: number; }
interface Lesson { id: string; title: string; type: string; preview: boolean; durationSec: number; textContent?: string; assetFilename?: string; hasVideo: boolean; hasAsset: boolean; }
interface Module { id: string; title: string; lessons: Lesson[]; }

const LESSON_ICON: Record<string, (p: { size?: number; className?: string }) => React.ReactNode> = {
  video: IconPlay,
  text: IconBook,
  download: IconDownload,
};

type Signer = (kind: SignKind) => Promise<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>;

/* -------- Course settings -------- */
function CourseSettings({ course, onSaved, sign }: { course: Course; onSaved: () => void; sign: Signer }) {
  const { authedRequest } = useAuth();
  const [title, setTitle] = useState(course.title);
  const [shortDescription, setShort] = useState(course.shortDescription);
  const [description, setDescription] = useState(course.description);
  const [price, setPrice] = useState((course.priceCents / 100).toString());
  const [coverImageUrl, setCover] = useState(course.coverImageUrl);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [note, setNote] = useState('');

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNote('');
    try {
      const res = await uploadToCloudinary(file, 'course_cover', sign);
      setCover(res.url);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Upload failed — paste a URL instead.');
    }
  }

  async function save() {
    setStatus('saving');
    try {
      await authedRequest(`/api/courses/${course.id}`, {
        method: 'PATCH',
        body: { title, shortDescription, description, priceCents: Math.round(parseFloat(price || '0') * 100), coverImageUrl },
      });
      setStatus('saved');
      onSaved();
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center gap-4">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
        ) : (
          <span className="grid h-16 w-24 place-items-center rounded-lg bg-surface-muted text-neutral-400"><IconImage size={22} /></span>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-medium shadow-xs hover:bg-surface-muted">
          <IconImage size={16} /> Upload cover
          <input type="file" accept="image/*" onChange={handleCover} className="hidden" />
        </label>
      </div>
      <Field label="Cover image URL" optional value={coverImageUrl} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
      {note && <Alert kind="info">{note}</Alert>}
      <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Field label="Short description" optional value={shortDescription} onChange={(e) => setShort(e.target.value)} />
      <Textarea label="Full description" optional rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Field label="Price (USD)" hint="0 = free" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={status === 'saving'}>Save settings</Button>
        {status === 'saved' && <span className="flex items-center gap-1 text-sm font-medium text-success-600"><IconCheck size={15} /> Saved</span>}
        {status === 'error' && <span className="text-sm text-danger-600">Failed to save</span>}
      </div>
    </div>
  );
}

/* -------- Lesson editor -------- */
function LessonEditor({ lesson, onSaved, onDeleted, sign }: { lesson: Lesson; onSaved: () => void; onDeleted: () => void; sign: Signer }) {
  const { authedRequest } = useAuth();
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState(lesson.type);
  const [preview, setPreview] = useState(lesson.preview);
  const [textContent, setText] = useState(lesson.textContent ?? '');
  const [media, setMedia] = useState<{ videoPublicId?: string; assetPublicId?: string; assetResourceType?: string; assetFilename?: string }>({});
  const [hasVideo, setHasVideo] = useState(lesson.hasVideo);
  const [assetName, setAssetName] = useState(lesson.assetFilename ?? '');
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [note, setNote] = useState('');

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNote('');
    try {
      if (type === 'video') {
        const res = await uploadToCloudinary(file, 'course_video', sign);
        setMedia({ videoPublicId: res.publicId });
        setHasVideo(true);
      } else {
        const res = await uploadToCloudinary(file, 'product_file', sign);
        setMedia({ assetPublicId: res.publicId, assetResourceType: 'raw', assetFilename: res.filename });
        setAssetName(res.filename);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Upload failed (media uploads need Cloudinary configured).');
    }
  }

  async function save() {
    setStatus('saving');
    try {
      await authedRequest(`/api/courses/lessons/${lesson.id}`, {
        method: 'PATCH',
        body: { title, type, preview, textContent, ...media },
      });
      onSaved();
    } finally {
      setStatus('idle');
    }
  }

  async function remove() {
    if (!confirm('Delete this lesson?')) return;
    await authedRequest(`/api/courses/lessons/${lesson.id}`, { method: 'DELETE' }).catch(() => {});
    onDeleted();
  }

  return (
    <div className="mt-2 space-y-4 rounded-xl border border-line bg-white p-4">
      <Field label="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>
        <span className="mb-2 block text-sm font-medium text-neutral-800">Type</span>
        <Segmented value={type} onChange={setType} size="sm" options={[
          { value: 'video', label: 'Video' }, { value: 'text', label: 'Text' }, { value: 'download', label: 'Download' },
        ]} />
      </div>

      {type === 'text' ? (
        <Textarea label="Lesson content" rows={5} value={textContent} onChange={(e) => setText(e.target.value)} placeholder="Write the lesson…" />
      ) : (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-neutral-800">{type === 'video' ? 'Video file' : 'Downloadable file'}</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-medium shadow-xs hover:bg-surface-muted">
              <IconUpload size={16} /> Upload {type === 'video' ? 'video' : 'file'}
              <input type="file" accept={type === 'video' ? 'video/*' : undefined} onChange={handleMedia} className="hidden" />
            </label>
            {type === 'video' && hasVideo && <span className="text-sm font-medium text-success-600">✓ video attached</span>}
            {type === 'download' && assetName && <span className="text-sm font-medium text-success-600">✓ {assetName}</span>}
          </div>
        </div>
      )}

      {note && <Alert kind="info">{note}</Alert>}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded border-line-strong accent-brand-600" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
        Free preview (visible on the course landing page)
      </label>

      <div className="flex items-center justify-between">
        <Button size="sm" onClick={save} loading={status === 'saving'}>Save lesson</Button>
        <Button size="sm" variant="ghost" onClick={remove} className="!text-danger-600 hover:!bg-danger-50">
          <IconTrash size={15} /> Delete
        </Button>
      </div>
    </div>
  );
}

function AddLessonRow({ onAdd }: { onAdd: (title: string, type: string) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('video');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await onAdd(title.trim(), type);
    setTitle('');
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New lesson title"
        className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm shadow-xs outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
      />
      <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-lg border border-line-strong bg-white px-2 text-sm shadow-xs outline-none focus:border-brand-400">
        <option value="video">Video</option>
        <option value="text">Text</option>
        <option value="download">Download</option>
      </select>
      <Button type="submit" size="sm" variant="secondary" loading={busy}>Add</Button>
    </form>
  );
}

function CourseEditor({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const { authedRequest } = useAuth();
  const [data, setData] = useState<{ course: Course; modules: Module[] } | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  const sign = useCallback<Signer>(
    (kind) => authedRequest('/api/cloudinary/sign-upload', { method: 'POST', body: { kind } }),
    [authedRequest],
  );

  const load = useCallback(async () => {
    setData(await authedRequest(`/api/courses/${courseId}`));
  }, [authedRequest, courseId]);
  useEffect(() => { void load(); }, [load]);

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleTitle.trim()) return;
    await authedRequest(`/api/courses/${courseId}/modules`, { method: 'POST', body: { title: moduleTitle } });
    setModuleTitle('');
    await load();
  }
  async function addLesson(moduleId: string, title: string, type: string) {
    await authedRequest(`/api/courses/${courseId}/lessons`, { method: 'POST', body: { moduleId, title, type } });
    await load();
  }
  async function publish() {
    setError('');
    try { await authedRequest(`/api/courses/${courseId}/publish`, { method: 'POST' }); await load(); }
    catch (e) { setError(e instanceof ApiException ? e.message : 'Failed'); }
  }

  if (!data) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-ink">
        <IconArrowLeft size={16} /> All courses
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">{data.course.title}</h2>
          <Badge tone={data.course.status === 'published' ? 'success' : 'neutral'} dot>{data.course.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowSettings((s) => !s)}>Course settings</Button>
          {data.course.status !== 'published' && <Button onClick={publish}>Publish course</Button>}
        </div>
      </div>
      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}

      {showSettings && (
        <Card className="mt-4">
          <SectionHeading title="Course settings" subtitle="Pricing, description and cover image." />
          <CourseSettings course={data.course} sign={sign} onSaved={load} />
        </Card>
      )}

      <div className="mt-5 space-y-4">
        {data.modules.length === 0 && <p className="text-sm text-neutral-500">No modules yet — add your first one below.</p>}
        {data.modules.map((m, idx) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                <span className="mr-2 text-neutral-400">{String(idx + 1).padStart(2, '0')}</span>
                {m.title}
              </h3>
              <span className="text-xs text-neutral-400">{m.lessons.length} lesson(s)</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {m.lessons.map((l) => {
                const Icon = LESSON_ICON[l.type] ?? IconBook;
                const isOpen = openLesson === l.id;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => setOpenLesson(isOpen ? null : l.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition',
                        isOpen ? 'border-brand-300 bg-brand-50/40' : 'border-line bg-surface-subtle hover:border-line-strong',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={15} className="text-neutral-400" />
                        {l.title}
                        <span className="text-xs text-neutral-400">· {l.type}</span>
                        {l.preview && <Badge tone="brand"><span className="flex items-center gap-1"><IconEye size={11} /> preview</span></Badge>}
                      </span>
                      <IconChevronDown size={16} className={cn('text-neutral-400 transition', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <LessonEditor
                        lesson={l}
                        sign={sign}
                        onSaved={() => { setOpenLesson(null); void load(); }}
                        onDeleted={() => { setOpenLesson(null); void load(); }}
                      />
                    )}
                  </li>
                );
              })}
              {m.lessons.length === 0 && <li className="text-xs text-neutral-400">No lessons yet.</li>}
            </ul>
            <AddLessonRow onAdd={(title, type) => addLesson(m.id, title, type)} />
          </Card>
        ))}
      </div>

      <form onSubmit={addModule} className="mt-4 flex gap-2">
        <input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="New module title"
          className="h-10 flex-1 rounded-lg border border-line-strong bg-white px-3.5 text-sm shadow-xs outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15" />
        <Button type="submit" variant="secondary"><IconPlus size={16} /> Add module</Button>
      </form>
    </div>
  );
}

function CoursesManager() {
  const { authedRequest } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    const res = await authedRequest<{ courses: Course[] }>('/api/courses');
    setCourses(res.courses);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await authedRequest<{ course: Course }>('/api/courses', {
      method: 'POST', body: { title, priceCents: Math.round(parseFloat(price || '0') * 100) },
    });
    setCreating(false); setTitle(''); setPrice('');
    await load();
    setEditingId(res.course.id);
  }

  return (
    <DashboardShell
      title={editingId ? 'Edit course' : 'Courses'}
      subtitle={editingId ? undefined : 'Bundle videos, lessons and downloads into a course.'}
      breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Courses' }]}
      actions={!editingId && !creating && <Button onClick={() => setCreating(true)}><IconPlus size={16} /> New course</Button>}
    >
      {editingId ? (
        <CourseEditor courseId={editingId} onBack={() => { setEditingId(null); void load(); }} />
      ) : (
        <>
          {creating && (
            <Card className="mb-6">
              <SectionHeading title="New course" />
              <form onSubmit={create} className="mt-4 space-y-4">
                <Field label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
                <Field label="Price (USD)" hint="Set 0 to make the course free" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="submit">Create & edit</Button>
                  <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          )}

          {courses === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : courses.length === 0 && !creating ? (
            <EmptyState
              icon={<IconBook size={24} />}
              title="No courses yet"
              description="Create a course, add modules and lessons, then publish it to your storefront."
              action={<Button onClick={() => setCreating(true)}><IconPlus size={16} /> New course</Button>}
            />
          ) : (
            <div className="space-y-3">
              {courses.map((c) => (
                <Card key={c.id} padded={false} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <IconBook size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.title}</span>
                        <Badge tone={c.status === 'published' ? 'success' : 'neutral'}>{c.status}</Badge>
                      </div>
                      <div className="mt-0.5 text-sm text-neutral-500">
                        {c.priceCents ? formatPrice(c.priceCents, c.currency) : 'Free'} · {c.enrollmentCount} enrolled
                      </div>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditingId(c.id)}>Edit</Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default function CoursesPage() {
  return <CoursesManager />;
}
