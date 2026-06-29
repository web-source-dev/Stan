'use client';

import { use, useEffect, useState } from 'react';
import { apiRequest, ApiException } from '@/lib/api';
import { Card, Button, Alert, Badge, PageLoader } from '@/components/ui';
import { IconCalendar, IconExternal, IconPlay } from '@/components/icons';

interface RegistrationView {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  durationMin: number;
  status: string;
  displayStatus?: string;
  meetingUrl: string;
  replayUrl: string;
  whenText: string;
}

export default function ManageWebinarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [registration, setRegistration] = useState<RegistrationView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await apiRequest<{ registration: RegistrationView }>(`/api/webinar-registrations/manage/${token}`, {
        credentials: false,
      });
      setRegistration(res.registration);
    } catch (err) {
      if (err instanceof ApiException) setNotFound(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function cancel() {
    if (!confirm('Cancel your webinar registration?')) return;
    setBusy(true);
    await apiRequest(`/api/webinar-registrations/manage/${token}/cancel`, { method: 'POST', credentials: false }).catch(() => {});
    await load();
    setBusy(false);
  }

  if (notFound) {
    return <div className="flex min-h-screen items-center justify-center px-5 text-sm text-neutral-500">Registration not found.</div>;
  }
  if (!registration) return <PageLoader />;

  const label = registration.displayStatus ?? registration.status;
  const tone =
    label === 'confirmed' || label === 'in progress'
      ? 'success'
      : label === 'cancelled'
        ? 'danger'
        : label === 'pending payment'
          ? 'warn'
          : label === 'ended'
            ? 'neutral'
            : 'neutral';

  const canJoin =
    (registration.status === 'confirmed' || registration.displayStatus === 'in progress') && Boolean(registration.meetingUrl);
  const showReplay = registration.displayStatus === 'ended' && Boolean(registration.replayUrl);

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <Card className="w-full">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <IconCalendar size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{registration.title}</h1>
            <Badge tone={tone} dot>
              {label}
            </Badge>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5 text-sm text-neutral-700">
          {registration.whenText}
          <span className="mt-1 block text-xs text-neutral-500">{registration.durationMin} minutes</span>
        </p>

        {canJoin && (
          <a
            href={registration.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:shadow-glow"
          >
            <IconExternal size={16} /> Join webinar
          </a>
        )}

        {showReplay && (
          <a
            href={registration.replayUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-300"
          >
            <IconPlay size={16} /> Watch replay
          </a>
        )}

        {registration.status === 'cancelled' ? (
          <div className="mt-4">
            <Alert kind="info">This registration was cancelled.</Alert>
          </div>
        ) : registration.status !== 'pending_payment' ? (
          <div className="mt-5">
            <Button variant="secondary" onClick={cancel} loading={busy} fullWidth>
              Cancel registration
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
