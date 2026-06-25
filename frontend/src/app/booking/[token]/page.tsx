'use client';

import { use, useEffect, useState } from 'react';
import { apiRequest, ApiException } from '@/lib/api';
import { Card, Button, Alert, Badge, PageLoader } from '@/components/ui';
import { IconCalendar, IconExternal } from '@/components/icons';

interface BookingView {
  id: string; title: string; startAt: string; endAt: string; timezone: string;
  status: string; displayStatus?: string; meetingUrl: string; whenText: string;
}

export default function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await apiRequest<{ booking: BookingView }>(`/api/bookings/manage/${token}`, { credentials: false });
      setBooking(res.booking);
    } catch (err) {
      if (err instanceof ApiException) setNotFound(true);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function cancel() {
    if (!confirm('Cancel this booking?')) return;
    setBusy(true);
    await apiRequest(`/api/bookings/manage/${token}/cancel`, { method: 'POST', credentials: false }).catch(() => {});
    await load();
    setBusy(false);
  }

  if (notFound) {
    return <div className="flex min-h-screen items-center justify-center px-5 text-sm text-neutral-500">Booking not found.</div>;
  }
  if (!booking) return <PageLoader />;

  const label = booking.displayStatus ?? booking.status;
  const tone = label === 'confirmed' || label === 'in progress' ? 'success' : label === 'cancelled' ? 'danger' : label === 'pending payment' ? 'warn' : 'neutral';

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <Card className="w-full">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <IconCalendar size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{booking.title}</h1>
            <Badge tone={tone} dot>{label}</Badge>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-sm text-neutral-700">
          {booking.whenText}
        </p>

        {(booking.status === 'confirmed' || booking.displayStatus === 'in progress') && booking.meetingUrl && (
          <a href={booking.meetingUrl} target="_blank" rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:shadow-glow">
            <IconExternal size={16} /> Join meeting
          </a>
        )}

        {booking.status === 'cancelled' ? (
          <div className="mt-4"><Alert kind="info">This booking was cancelled.</Alert></div>
        ) : (
          <div className="mt-5">
            <Button variant="secondary" onClick={cancel} loading={busy} fullWidth>
              Cancel booking
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
