'use client';

import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { WebinarEditor } from '@/components/stan/WebinarEditor';
import { buildInitialWebinar } from '@/lib/webinar-types';

export default function NewWebinarPage() {
  const router = useRouter();

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'Products', href: '/dashboard/products' }, { label: 'Add Webinar' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <WebinarEditor initial={buildInitialWebinar()} onSaved={() => router.push('/dashboard/products')} />
      </div>
    </DashboardShell>
  );
}
