'use client';

import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { CourseEditor } from '@/components/stan/CourseEditor';
import { buildInitialCourse } from '@/lib/course-types';

export default function NewCoursePage() {
  const router = useRouter();

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'My Store', href: '/dashboard/storefront' }, { label: 'Add eCourse' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <CourseEditor
          initial={buildInitialCourse()}
          onSaved={() => router.push('/dashboard/courses')}
        />
      </div>
    </DashboardShell>
  );
}
