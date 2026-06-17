'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { CourseLessonBuilder } from '@/components/stan/CourseLessonBuilder';

export default function CourseLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');

  useEffect(() => {
    void params.then((p) => {
      setCourseId(p.id);
      setLessonId(p.lessonId);
    });
  }, [params]);

  if (!courseId || !lessonId) return null;

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[
        { label: 'Courses', href: '/dashboard/courses' },
        { label: 'Edit eCourse', href: `/dashboard/courses/${courseId}/edit` },
        { label: 'Course Builder' },
      ]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <CourseLessonBuilder
          courseId={courseId}
          lessonId={lessonId}
          onBack={() => router.push(`/dashboard/courses/${courseId}/edit`)}
        />
      </div>
    </DashboardShell>
  );
}
