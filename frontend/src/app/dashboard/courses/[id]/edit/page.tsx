'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { CourseEditor } from '@/components/stan/CourseEditor';
import { useAuth } from '@/lib/auth-context';
import { courseFromApi, type ApiCourse, type CourseEditorState, type CourseModule } from '@/lib/course-types';

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [initial, setInitial] = useState<CourseEditorState | null>(null);
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authedRequest<{ course: ApiCourse; modules: CourseModule[] }>(`/api/courses/${id}`);
    setInitial(courseFromApi(res.course, res.modules));
  }, [authedRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initial) return null;

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'Courses', href: '/dashboard/courses' }, { label: 'Edit eCourse' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <CourseEditor initial={initial} onSaved={() => router.push('/dashboard/courses')} />
      </div>
    </DashboardShell>
  );
}
