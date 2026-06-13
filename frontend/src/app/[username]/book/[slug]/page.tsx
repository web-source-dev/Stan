'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiException } from '@/lib/api';
import { Card, Button, Field, Alert, PageLoader } from '@/components/ui';
import { IconArrowLeft, IconClock, IconCalendar, IconCheckCircle } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface BookingType {
  id: string; title: string; slug: string; description: string; durationMin: number;
  priceCents: number; currency: string; timezone: string; creatorName: string; intakeQuestions: string[];
}
interface Slot { startIso: string; endIso: string }

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz,
  });
}

export default function BookingPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = use(params);
  const [bt, setBt] = useState<BookingType | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ status: string; manageToken?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  // Load booking type metadata + availability slots.
  useEffect(() => {
    (async () => {
      try {
        const avail = await apiRequest<{ timezone: string; durationMin: number; slots: Slot[] }>(
          `/api/bookings/availability?username=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}`,
          { credentials: false },
        );
        setSlots(avail.slots);
        // Fetch the type metadata from the storefront product-style endpoint.
        const sf = await apiRequest<{ bookingTypes: BookingType[] }>(`/api/storefront/${encodeURIComponent(username)}`, { credentials: false });
        const found = sf.bookingTypes.find((b) => b.slug === slug);
        if (found) setBt({ ...found, timezone: avail.timezone, creatorName: '', intakeQuestions: found.intakeQuestions ?? [] } as BookingType);
        else setMissing(true);
      } catch (err) {
        if (err instanceof ApiException && err.status === 404) setMissing(true);
      }
    })();
  }, [username, slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const intakeAnswers = (bt?.intakeQuestions ?? []).map((q, i) => ({ question: q, answer: answers[i] ?? '' }));
      const res = await apiRequest<{ status: string; manageToken?: string; checkoutUrl?: string }>('/api/bookings', {
        method: 'POST', credentials: false,
        body: { username, slug, email, name, startIso: selected, intakeAnswers },
      });
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      setDone({ status: res.status, manageToken: res.manageToken });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not book');
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-sm text-neutral-500">
        This booking page was not found.
      </div>
    );
  }
  if (!bt || slots === null) return <PageLoader />;

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <Card className="w-full text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-50 text-success-600">
            <IconCheckCircle size={28} />
          </div>
          <h1 className="mt-4 text-xl font-bold">{done.status === 'confirmed' ? 'Booking confirmed' : 'Almost there'}</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {done.status === 'confirmed' ? 'Check your email for the confirmation and meeting link.' : 'Complete payment to confirm your booking.'}
          </p>
          {done.manageToken && (
            <Link href={`/booking/${done.manageToken}`} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
              Manage booking →
            </Link>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href={`/${username}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-ink">
          <IconArrowLeft size={16} /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{bt.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5"><IconClock size={15} /> {bt.durationMin} min</span>
          <span className="font-medium text-ink">{bt.priceCents ? formatPrice(bt.priceCents, bt.currency) : 'Free'}</span>
          <span>Times shown in {bt.timezone}</span>
        </div>
        {bt.description && <p className="mt-3 text-sm leading-relaxed text-neutral-700">{bt.description}</p>}

        <form onSubmit={submit} className="mt-7 space-y-6">
          {error && <Alert kind="error">{error}</Alert>}

          <Card>
            <span className="flex items-center gap-2 text-sm font-semibold"><IconCalendar size={16} className="text-brand-600" /> Pick a time</span>
            {slots.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No times available right now. Check back later.</p>
            ) : (
              <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {slots.slice(0, 60).map((s) => (
                  <button key={s.startIso} type="button" onClick={() => setSelected(s.startIso)}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-xs font-medium transition',
                      selected === s.startIso
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
                        : 'border-line-strong bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50/40',
                    )}>
                    {fmt(s.startIso, bt.timezone)}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {bt.intakeQuestions.map((q, i) => (
              <Field key={i} label={q} value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
            ))}
          </Card>

          <Button type="submit" loading={busy} disabled={!selected} size="lg" fullWidth>
            {bt.priceCents ? `Continue · ${formatPrice(bt.priceCents, bt.currency)}` : 'Confirm booking'}
          </Button>
        </form>
      </div>
    </div>
  );
}
