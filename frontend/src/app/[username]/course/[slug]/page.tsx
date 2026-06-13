import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiRequest, ApiException } from '@/lib/api';
import { Card } from '@/components/ui';
import { CourseCTA } from '@/components/CourseCTA';
import { IconArrowLeft, IconBook, IconPlay, IconDownload, IconEye } from '@/components/icons';
import { formatPrice } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ username: string; slug: string }> };

interface CourseData {
  course: {
    id: string; title: string; slug: string; shortDescription: string; description: string;
    priceCents: number; currency: string; coverImageUrl: string; creatorName: string; username: string;
  };
  modules: { id: string; title: string; lessons: { id: string; title: string; type: string; preview: boolean; durationSec: number }[] }[];
}

const LESSON_ICON: Record<string, (p: { size?: number; className?: string }) => React.ReactNode> = {
  video: IconPlay,
  text: IconBook,
  download: IconDownload,
};

async function load(username: string, slug: string) {
  try {
    return await apiRequest<CourseData>(`/api/storefront/${username}/courses/${slug}`, { credentials: false });
  } catch (err) {
    if (err instanceof ApiException && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

export default async function CourseLandingPage({ params }: Props) {
  const { username, slug } = await params;
  const data = await load(username, slug);
  if (!data) notFound();
  const { course, modules } = data;
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/${username}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-ink">
          <IconArrowLeft size={16} /> {course.creatorName || username}
        </Link>

        <div className="mt-5 grid gap-7 md:grid-cols-[1fr_300px]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              <IconBook size={13} /> Course
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{course.title}</h1>
            {course.shortDescription && <p className="mt-2 text-lg text-neutral-600">{course.shortDescription}</p>}
            {course.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-neutral-700">{course.description}</p>}

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {modules.length} modules · {lessonCount} lessons
            </h2>
            <div className="mt-3 space-y-3">
              {modules.map((m, idx) => (
                <Card key={m.id} padded={false} className="p-4">
                  <h3 className="font-semibold">
                    <span className="mr-2 text-neutral-400">{String(idx + 1).padStart(2, '0')}</span>
                    {m.title}
                  </h3>
                  <ul className="mt-2.5 space-y-1.5 text-sm">
                    {m.lessons.map((l) => {
                      const Icon = LESSON_ICON[l.type] ?? IconBook;
                      return (
                        <li key={l.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-subtle px-3 py-2">
                          <span className="flex items-center gap-2 text-neutral-700">
                            <Icon size={15} className="text-neutral-400" />
                            {l.title}
                          </span>
                          {l.preview && (
                            <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700">
                              <IconEye size={12} /> Preview
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <div className="md:sticky md:top-6">
              <Card>
                {course.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.coverImageUrl} alt={course.title} className="mb-4 h-40 w-full rounded-xl object-cover" />
                )}
                <div className="text-3xl font-bold tracking-tight">{course.priceCents ? formatPrice(course.priceCents, course.currency) : 'Free'}</div>
                <p className="mt-1 text-sm text-neutral-500">Lifetime access · learn at your pace</p>
                <CourseCTA username={username} slug={slug} priceCents={course.priceCents} currency={course.currency} accent="#5b54e8" />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
