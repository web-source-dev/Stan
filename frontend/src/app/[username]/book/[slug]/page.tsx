'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiException } from '@/lib/api';
import { Card, Button, Field, Alert, PageLoader } from '@/components/ui';
import { IconArrowLeft, IconClock, IconCalendar, IconCheckCircle, IconGlobe, IconExternal } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface BookingType {
  id: string; title: string; slug: string; description: string; durationMin: number;
  priceCents: number; currency: string; timezone: string; creatorName: string; intakeQuestions: string[];
}
interface Slot { startIso: string; endIso: string }

/** Sortable day key (YYYY-MM-DD) in the booking type's timezone. */
function dayKey(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
}
function timeLabel(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz });
}
function dayWeekday(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', timeZone: tz });
}
function dayShort(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz });
}
function fullWhen(iso: string, tz: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz,
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
  const [paypal, setPaypal] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [creator, setCreator] = useState<{ name: string; avatarUrl: string }>({ name: '', avatarUrl: '' });
  const formRef = useRef<HTMLFormElement>(null);

  // Group availability by day (in the booking type's timezone).
  const days = useMemo(() => {
    if (!slots || !bt) return [] as { key: string; firstIso: string; slots: Slot[] }[];
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = dayKey(s.startIso, bt.timezone);
      (map.get(k) ?? map.set(k, []).get(k)!).push(s);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, ss]) => ({ key, firstIso: ss[0].startIso, slots: ss }));
  }, [slots, bt]);

  // Default to the first day with availability.
  useEffect(() => {
    if (days.length && !selectedDay) setSelectedDay(days[0].key);
  }, [days, selectedDay]);

  const dayTimes = days.find((d) => d.key === selectedDay)?.slots ?? [];

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
        const sf = await apiRequest<{ bookingTypes: BookingType[]; profile?: { displayName?: string; username?: string; avatarUrl?: string } }>(`/api/storefront/${encodeURIComponent(username)}`, { credentials: false });
        if (sf.profile) setCreator({ name: sf.profile.displayName || sf.profile.username || '', avatarUrl: sf.profile.avatarUrl || '' });
        const found = sf.bookingTypes.find((b) => b.slug === slug);
        if (found) setBt({ ...found, timezone: avail.timezone, creatorName: '', intakeQuestions: found.intakeQuestions ?? [] } as BookingType);
        else setMissing(true);
      } catch (err) {
        if (err instanceof ApiException && err.status === 404) setMissing(true);
      }
    })();
  }, [username, slug]);

  // Which payment methods this storefront offers (to show the PayPal option).
  useEffect(() => {
    apiRequest<{ paypal: boolean }>(`/api/checkout/payment-methods/${encodeURIComponent(username)}`, { credentials: false })
      .then((m) => setPaypal(m.paypal))
      .catch(() => {});
  }, [username]);

  async function start(provider: 'stripe' | 'paypal') {
    if (busy || !selected) return;
    setError(''); setBusy(true);
    try {
      const intakeAnswers = (bt?.intakeQuestions ?? []).map((q, i) => ({ question: q, answer: answers[i] ?? '' }));
      const res = await apiRequest<{ status: string; manageToken?: string; checkoutUrl?: string }>('/api/bookings', {
        method: 'POST', credentials: false,
        body: { username, slug, email, name, startIso: selected, intakeAnswers, provider },
      });
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      setDone({ status: res.status, manageToken: res.manageToken });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not book');
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void start('stripe');
  }
  function payWithPayPal() {
    if (!selected) { setError('Please pick a time first.'); return; }
    if (formRef.current && !formRef.current.reportValidity()) return;
    void start('paypal');
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
      <div className="grid min-h-screen place-items-center bg-brand-radial px-5">
        <Card className="w-full max-w-md text-center animate-scale-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success-50 text-success-600">
            <IconCheckCircle size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">{done.status === 'confirmed' ? 'Booking confirmed 🎉' : 'Almost there'}</h1>
          {selected && (
            <p className="mt-2 text-sm font-semibold text-[#1a1c3a]">{bt.title} · {fullWhen(selected, bt.timezone)}</p>
          )}
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
            {done.status === 'confirmed'
              ? "We've emailed your confirmation and meeting link — and we'll remind you before it starts."
              : 'Complete payment to lock in your booking.'}
          </p>
          {done.manageToken && (
            <Link href={`/booking/${done.manageToken}`} className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              Manage booking <IconExternal size={15} />
            </Link>
          )}
          <Link href={`/${username}`} className="mt-3 block text-sm font-medium text-neutral-500 hover:text-ink">Back to store</Link>
        </Card>
      </div>
    );
  }

  const priceText = bt.priceCents ? formatPrice(bt.priceCents, bt.currency) : 'Free';
  const initials = (creator.name || username).slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-radial px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <Link href={`/${username}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-ink">
          <IconArrowLeft size={16} /> Back to store
        </Link>

        <form ref={formRef} onSubmit={submit} className="mt-4 overflow-hidden rounded-3xl bg-white shadow-lift lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Summary panel */}
          <div className="border-b border-line bg-[#fafafe] p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              {creator.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatarUrl} alt={creator.name} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials}</div>
              )}
              <div className="min-w-0">
                {creator.name && <div className="truncate text-sm font-semibold text-neutral-500">{creator.name}</div>}
                <div className="inline-flex items-center gap-1 text-xs font-bold text-brand-600"><IconCalendar size={12} /> Book a call</div>
              </div>
            </div>

            <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight text-[#1a1c3a]">{bt.title}</h1>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-neutral-600"><IconClock size={16} className="shrink-0 text-brand-600" /> {bt.durationMin} minutes</div>
              <div className="flex items-center gap-2.5 text-neutral-600"><span className="grid h-4 w-4 shrink-0 place-items-center font-bold text-brand-600">$</span><span className="font-semibold text-[#1a1c3a]">{priceText}</span></div>
              <div className="flex items-center gap-2.5 text-neutral-600"><IconGlobe size={16} className="shrink-0 text-brand-600" /> Times in {bt.timezone.replace(/_/g, ' ')}</div>
            </div>
            {bt.description && <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-neutral-600">{bt.description}</p>}
            {selected && (
              <div className="mt-5 rounded-2xl border border-brand-200 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600"><IconCheckCircle size={13} /> Selected</div>
                <div className="mt-1 text-sm font-bold leading-snug text-[#1a1c3a]">{fullWhen(selected, bt.timezone)}</div>
              </div>
            )}
          </div>

          {/* Scheduler */}
          <div className="p-6 sm:p-7">
            {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

            {slots.length === 0 ? (
              <div className="grid h-full min-h-[300px] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-muted text-neutral-400"><IconCalendar size={26} /></div>
                  <h2 className="mt-4 text-lg font-bold text-[#1a1c3a]">No times available</h2>
                  <p className="mt-1 text-sm text-neutral-500">There&apos;s no open availability right now — please check back later.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Step 1: date */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Select a date</h2>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {days.map((d) => {
                      const on = d.key === selectedDay;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => { setSelectedDay(d.key); setSelected(''); }}
                          className={cn(
                            'flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2.5 text-center transition',
                            on ? 'border-brand-600 bg-brand-600 text-white shadow-soft' : 'border-line-strong bg-white text-[#1a1c3a] hover:border-brand-300 hover:bg-brand-50/40',
                          )}
                        >
                          <span className={cn('text-[11px] font-semibold uppercase', on ? 'text-white/80' : 'text-neutral-400')}>{dayWeekday(d.firstIso, bt.timezone)}</span>
                          <span className="text-sm font-bold">{dayShort(d.firstIso, bt.timezone)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: time */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Select a time</h2>
                  <div className="mt-3 grid max-h-[240px] grid-cols-2 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-3">
                    {dayTimes.map((s) => {
                      const on = selected === s.startIso;
                      return (
                        <button
                          key={s.startIso}
                          type="button"
                          onClick={() => setSelected(s.startIso)}
                          className={cn(
                            'rounded-xl border py-2.5 text-sm font-semibold transition',
                            on ? 'border-brand-600 bg-brand-600 text-white shadow-soft' : 'border-line-strong bg-white text-[#1a1c3a] hover:border-brand-400 hover:bg-brand-50/50',
                          )}
                        >
                          {timeLabel(s.startIso, bt.timezone)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: details (revealed after a time is picked) */}
                {selected && (
                  <div className="animate-fade border-t border-line pt-5">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Your details</h2>
                    <div className="mt-3 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                        <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      {bt.intakeQuestions.map((q, i) => (
                        <Field key={i} label={q} value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
                      ))}

                      <Button type="submit" loading={busy} size="lg" fullWidth>
                        {bt.priceCents ? `Continue · ${priceText}` : 'Confirm booking'}
                      </Button>

                      {bt.priceCents > 0 && paypal && (
                        <button
                          type="button"
                          onClick={payWithPayPal}
                          disabled={busy}
                          aria-label="Pay with PayPal"
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ffc439] py-3 text-sm font-bold text-[#003087] transition hover:brightness-[1.03] disabled:opacity-60"
                        >
                          <span>Pay with</span>
                          <span className="font-extrabold italic"><span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span></span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-400">Powered by CreatorStore</p>
      </div>
    </div>
  );
}
