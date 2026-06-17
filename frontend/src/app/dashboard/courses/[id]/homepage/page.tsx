'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { CourseHomepageEditor } from '@/components/stan/CourseHomepageEditor';
import { useAuth } from '@/lib/auth-context';
import { courseFromApi, type ApiCourse, type CourseEditorState } from '@/lib/course-types';
import { IconArrowLeft } from '@/components/icons';

export default function CourseHomepagePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [initial, setInitial] = useState<Pick<
    CourseEditorState,
    'homepageTitle' | 'homepageDescription' | 'homepageCoverImageUrl' | 'homepageCoverPublicId' | 'titleFont' | 'backgroundColor' | 'highlightColor'
  > | null>(null);
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authedRequest<{ course: ApiCourse }>(`/api/courses/${id}`);
    const full = courseFromApi(res.course);
    setInitial({
      homepageTitle: full.homepageTitle,
      homepageDescription: full.homepageDescription,
      homepageCoverImageUrl: full.homepageCoverImageUrl,
      homepageCoverPublicId: full.homepageCoverPublicId,
      titleFont: full.titleFont,
      backgroundColor: full.backgroundColor,
      highlightColor: full.highlightColor,
    });
  }, [authedRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initial || !id) return null;

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[
        { label: 'Courses', href: '/dashboard/courses' },
        { label: 'Edit eCourse', href: `/dashboard/courses/${id}/edit` },
        { label: 'Homepage' },
      ]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <Link
          href={`/dashboard/courses/${id}/edit`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-ink"
        >
          <IconArrowLeft size={16} /> Back to course editor
        </Link>
        <CourseHomepageEditor
          courseId={id}
          initial={initial}
          onSaved={() => router.push(`/dashboard/courses/${id}/edit?tab=course`)}
          onCancel={() => router.push(`/dashboard/courses/${id}/edit`)}
        />
      </div>
    </DashboardShell>
  );
}
