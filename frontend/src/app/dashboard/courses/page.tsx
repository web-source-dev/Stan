'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/DashboardShell';
import { FeatureGate } from '@/components/FeatureGate';
import { Button, Card, Badge, EmptyState, Skeleton } from '@/components/ui';
import { IconPlus, IconBook } from '@/components/icons';
import { formatPrice } from '@/lib/types';

interface Course {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  currency: string;
  status: string;
  enrollmentCount: number;
}

export default function CoursesPage() {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);

  const load = useCallback(async () => {
    const res = await authedRequest<{ courses: Course[] }>('/api/courses');
    setCourses(res.courses);
  }, [authedRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title="Courses"
      subtitle="Create, host, and sell your course within your store."
      maxWidth="max-w-6xl"
      breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Courses' }]}
      actions={
        <Button onClick={() => router.push('/dashboard/courses/new')}>
          <IconPlus size={16} /> New course
        </Button>
      }
    >
      <FeatureGate feature="courses" name="Courses" tier="Pro">
      {courses === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<IconBook size={24} />}
          title="No courses yet"
          description="Create a course, add modules and lessons, then publish it to your storefront."
          action={
            <Button onClick={() => router.push('/dashboard/courses/new')}>
              <IconPlus size={16} /> New course
            </Button>
          }
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
              <Link
                href={`/dashboard/courses/${c.id}/edit`}
                className="inline-flex shrink-0 items-center rounded-lg border border-line-strong bg-white px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-surface-muted"
              >
                Edit
              </Link>
            </Card>
          ))}
        </div>
      )}
      </FeatureGate>
    </DashboardShell>
  );
}
