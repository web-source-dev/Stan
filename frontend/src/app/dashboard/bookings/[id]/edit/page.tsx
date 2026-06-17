'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PaymentBanner } from '@/components/stan/PaymentBanner';
import { BookingEditor } from '@/components/stan/BookingEditor';
import { useAuth } from '@/lib/auth-context';
import { bookingFromApi, type ApiBookingType, type BookingEditorState } from '@/lib/booking-types';

export default function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { authedRequest } = useAuth();
  const [initial, setInitial] = useState<BookingEditorState | null>(null);
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authedRequest<{ bookingType: ApiBookingType }>(`/api/booking-types/${id}`);
    setInitial(bookingFromApi(res.bookingType));
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
      breadcrumb={[{ label: 'Appointments', href: '/dashboard/bookings' }, { label: 'Edit Coaching Call' }]}
    >
      <PaymentBanner />
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <BookingEditor initial={initial} onSaved={() => router.push('/dashboard/bookings')} />
      </div>
    </DashboardShell>
  );
}
