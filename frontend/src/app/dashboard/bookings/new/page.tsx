'use client';

import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { BookingEditor } from '@/components/stan/BookingEditor';
import { buildInitialBooking } from '@/lib/booking-types';

export default function NewBookingPage() {
  const router = useRouter();

  return (
    <DashboardShell
      title=""
      hideSubtitle
      maxWidth="max-w-[1280px]"
      breadcrumb={[{ label: 'My Store', href: '/dashboard/storefront' }, { label: 'Add Coaching Call' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <BookingEditor
          initial={buildInitialBooking()}
          onSaved={() => router.push('/dashboard/bookings')}
        />
      </div>
    </DashboardShell>
  );
}
