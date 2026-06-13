'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { apiRequest, ApiException, API_URL } from '@/lib/api';
import { Card, Button, PageLoader } from '@/components/ui';
import { Logo, IconCheck, IconPlay, IconBook, IconDownload, IconCheckCircle } from '@/components/icons';
import { cn } from '@/lib/cn';

interface Lesson { id: string; title: string; type: string; durationSec: number; textContent?: string; hasVideo: boolean; hasDownload: boolean; completed: boolean; }
interface PlayerData {
  course: { id: string; title: string; shortDescription: string; coverImageUrl: string };
  progress: { completed: number; total: number; lastLessonId: string | null };
  modules: { id: string; title: string; lessons: Lesson[] }[];
}

const LESSON_ICON: Record<string, (p: { size?: number; className?: string }) => React.ReactNode> = {
  video: IconPlay,
  text: IconBook,
  download: IconDownload,
};

export default function PlayerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PlayerData | null>(null);
  const [active, setActive] = useState<Lesson | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<PlayerData>(`/api/learn/${token}`, { credentials: false });
      setData(res);
      const all = res.modules.flatMap((m) => m.lessons);
      setActive((cur) => cur ? all.find((l) => l.id === cur.id) ?? all[0] ?? null : all[0] ?? null);
    } catch (err) {
      if (err instanceof ApiException) setNotFound(true);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function toggleComplete(l: Lesson) {
    await apiRequest(`/api/learn/${token}/progress`, {
      method: 'POST', credentials: false, body: { lessonId: l.id, complete: !l.completed },
    }).catch(() => {});
    await load();
  }

  if (notFound) {
    return <div className="flex min-h-screen items-center justify-center px-5 text-sm text-neutral-500">This course link is invalid or was revoked.</div>;
  }
  if (!data) return <PageLoader />;

  const pct = data.progress.total ? Math.round((data.progress.completed / data.progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo glyphOnly className="sm:hidden" />
          <Logo className="hidden sm:flex" />
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">{data.progress.completed} / {data.progress.total} complete</span>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-brand-600">{pct}%</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{data.course.title}</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Curriculum */}
          <nav className="space-y-5 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto lg:pr-2">
            {data.modules.map((m) => (
              <div key={m.id}>
                <div className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">{m.title}</div>
                <ul className="mt-2 space-y-1">
                  {m.lessons.map((l) => {
                    const Icon = LESSON_ICON[l.type] ?? IconBook;
                    const isActive = active?.id === l.id;
                    return (
                      <li key={l.id}>
                        <button onClick={() => setActive(l)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition',
                            isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-neutral-700 hover:bg-surface-muted',
                          )}>
                          <span className={cn(
                            'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                            l.completed ? 'border-success-500 bg-success-500 text-white' : 'border-line-strong text-transparent',
                          )}>
                            <IconCheck size={12} />
                          </span>
                          <Icon size={14} className={isActive ? 'text-brand-600' : 'text-neutral-400'} />
                          <span className="truncate">{l.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Lesson content */}
          <main>
            {active ? (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{active.title}</h2>
                  <Button
                    variant={active.completed ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => toggleComplete(active)}
                  >
                    {active.completed ? 'Mark incomplete' : <><IconCheckCircle size={16} /> Mark complete</>}
                  </Button>
                </div>
                <div className="mt-5">
                  {active.hasVideo ? (
                    <video key={active.id} controls className="w-full rounded-xl bg-black"
                      src={`${API_URL}/api/learn/${token}/lesson/${active.id}/media`} />
                  ) : active.type === 'text' ? (
                    <div className="prose-sm whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                      {active.textContent || 'No content yet.'}
                    </div>
                  ) : active.hasDownload ? (
                    <a href={`${API_URL}/api/learn/${token}/lesson/${active.id}/media`}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-glow">
                      <IconDownload size={16} /> Download
                    </a>
                  ) : (
                    <p className="text-sm text-neutral-500">No media attached to this lesson yet.</p>
                  )}
                </div>
              </Card>
            ) : (
              <Card><p className="text-sm text-neutral-500">This course has no lessons yet.</p></Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
