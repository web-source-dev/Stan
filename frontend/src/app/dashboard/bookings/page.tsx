'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Button, Card, Field, Alert, Badge, EmptyState, Skeleton, SectionHeading, Segmented } from '@/components/ui';
import { IconPlus, IconCalendar, IconClock, IconExternal, IconList, IconArrowLeft, IconArrowRight } from '@/components/icons';
import { formatPrice } from '@/lib/types';
import { cn } from '@/lib/cn';

interface BookingType { id: string; title: string; slug: string; durationMin: number; priceCents: number; currency: string; status: string; }
interface Booking { id: string; title: string; buyerEmail: string; buyerName: string; startAt: string; endAt: string; status: string; meetingUrl: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function BookingList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<IconCalendar size={24} />}
        title="No upcoming bookings"
        description="Confirmed appointments from your published session types will appear here."
      />
    );
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <Card key={b.id} padded={false} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{b.title || 'Session'}</span>
              <Badge tone={b.status === 'confirmed' ? 'success' : b.status === 'pending' ? 'warn' : 'neutral'}>{b.status}</Badge>
            </div>
            <div className="mt-0.5 text-sm text-neutral-500">
              {b.buyerName || b.buyerEmail} · <span className="text-neutral-600">{fmtWhen(b.startAt)}</span>
            </div>
          </div>
          {b.meetingUrl && (
            <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-white px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-surface-muted">
              <IconExternal size={15} /> Join
            </a>
          )}
        </Card>
      ))}
    </div>
  );
}

/** Month-grid calendar with a Calendar/List toggle — matches Stan's Appointments. */
function AppointmentsCalendar({ bookings }: { bookings: Booking[] | null }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const byDay = new Map<string, Booking[]>();
  for (const b of bookings ?? []) {
    const key = ymd(new Date(b.startAt));
    byDay.set(key, [...(byDay.get(key) ?? []), b]);
  }

  // Build a 6-row grid of dates starting on the Sunday on/before the 1st.
  const first = new Date(cursor.year, cursor.month, 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const todayKey = ymd(today);
  function shift(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <Card padded={false} className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-neutral-500 hover:bg-surface-muted"><IconArrowLeft size={16} /></button>
          <span className="min-w-[140px] text-center text-lg font-semibold tracking-tight">{MONTHS[cursor.month]} {cursor.year}</span>
          <button onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-neutral-500 hover:bg-surface-muted"><IconArrowRight size={16} /></button>
        </div>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'calendar', label: <span className="flex items-center gap-1.5"><IconCalendar size={14} /> Calendar</span> },
            { value: 'list', label: <span className="flex items-center gap-1.5"><IconList size={14} /> List</span> },
          ]}
        />
      </div>

      {view === 'list' ? (
        <div className="p-4">
          {bookings === null ? <Skeleton className="h-40 w-full" /> : <BookingList bookings={bookings} />}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-7 border-b border-line bg-surface-subtle text-center text-xs font-medium uppercase tracking-wide text-neutral-500">
            {DAYS.map((d) => <div key={d} className="py-2.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === cursor.month;
              const isToday = key === todayKey;
              const dayBookings = byDay.get(key) ?? [];
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[88px] border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0',
                    !inMonth && 'bg-surface-subtle/60 text-neutral-300',
                  )}
                >
                  <div className="flex justify-end">
                    <span className={cn(
                      'grid h-6 w-6 place-items-center rounded-full text-xs',
                      isToday ? 'bg-brand-600 font-semibold text-white' : inMonth ? 'text-neutral-600' : 'text-neutral-300',
                    )}>
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayBookings.slice(0, 3).map((b) => (
                      <div key={b.id} title={`${b.title} · ${fmtWhen(b.startAt)}`} className="truncate rounded-md bg-brand-50 px-1.5 py-0.5 text-2xs font-medium text-brand-700">
                        {new Date(b.startAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} {b.title || 'Session'}
                      </div>
                    ))}
                    {dayBookings.length > 3 && <div className="px-1.5 text-2xs text-neutral-400">+{dayBookings.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function BookingsManager() {
  const { authedRequest } = useAuth();
  const [tab, setTab] = useState<'calendar' | 'types'>('calendar');
  const [types, setTypes] = useState<BookingType[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // create form
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [windows, setWindows] = useState<Record<number, { start: string; end: string; on: boolean }>>(
    Object.fromEntries(DAYS.map((_, i) => [i, { start: '09:00', end: '17:00', on: i >= 1 && i <= 5 }])),
  );

  const load = useCallback(async () => {
    const res = await authedRequest<{ bookingTypes: BookingType[] }>('/api/booking-types');
    setTypes(res.bookingTypes);
  }, [authedRequest]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    authedRequest<{ bookings: Booking[] }>('/api/booking-types/bookings')
      .then((r) => setBookings(r.bookings))
      .catch(() => setBookings([]));
  }, [authedRequest]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const weeklyWindows = Object.entries(windows)
      .filter(([, w]) => w.on)
      .map(([d, w]) => ({ weekday: Number(d), startMinute: toMin(w.start), endMinute: toMin(w.end) }));
    try {
      await authedRequest('/api/booking-types', {
        method: 'POST',
        body: {
          title,
          durationMin: Number(duration),
          priceCents: Math.round(parseFloat(price || '0') * 100),
          timezone: tz,
          meetingUrl: meetingUrl || undefined,
          weeklyWindows,
        },
      });
      setCreating(false); setTitle(''); setPrice(''); setMeetingUrl('');
      await load();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Failed to create');
    }
  }

  async function publish(id: string) {
    setError('');
    try { await authedRequest(`/api/booking-types/${id}/publish`, { method: 'POST' }); await load(); }
    catch (err) { setError(err instanceof ApiException ? err.message : 'Failed to publish'); }
  }

  return (
    <DashboardShell
      title="My Appointments"
      subtitle="Your calendar, plus the session types people can book."
      maxWidth="max-w-6xl"
      actions={tab === 'types' && !creating && <Button onClick={() => setCreating(true)}><IconPlus size={16} /> New session type</Button>}
    >
      <div className="mb-6">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'types', label: 'Session types' }]}
        />
      </div>

      {tab === 'calendar' ? (
        <AppointmentsCalendar bookings={bookings} />
      ) : (
        <>
          {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

          {creating && (
            <Card className="mb-6">
              <SectionHeading title="New session type" />
              <form onSubmit={create} className="mt-4 space-y-5">
                <Field label="Title" required placeholder="30-min strategy call" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Duration (min)" type="number" min="5" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  <Field label="Price (USD)" hint="0 = free" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <Field label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
                <Field label="Meeting link" optional placeholder="https://meet.google.com/…" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} hint="Manual link — provider integrations come later." />

                <div>
                  <span className="mb-2 block text-sm font-medium text-neutral-800">Weekly availability</span>
                  <div className="space-y-1.5 rounded-xl border border-line bg-surface-subtle p-3">
                    {DAYS.map((d, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-sm', !windows[i].on && 'opacity-60')}>
                        <label className="flex w-20 cursor-pointer items-center gap-2 font-medium">
                          <input type="checkbox" className="h-4 w-4 rounded border-line-strong accent-brand-600" checked={windows[i].on} onChange={(e) => setWindows((w) => ({ ...w, [i]: { ...w[i], on: e.target.checked } }))} />
                          {d}
                        </label>
                        <input type="time" disabled={!windows[i].on} value={windows[i].start} onChange={(e) => setWindows((w) => ({ ...w, [i]: { ...w[i], start: e.target.value } }))} className="rounded-lg border border-line-strong bg-white px-2 py-1 shadow-xs outline-none focus:border-brand-400 disabled:opacity-40" />
                        <span className="text-neutral-400">–</span>
                        <input type="time" disabled={!windows[i].on} value={windows[i].end} onChange={(e) => setWindows((w) => ({ ...w, [i]: { ...w[i], end: e.target.value } }))} className="rounded-lg border border-line-strong bg-white px-2 py-1 shadow-xs outline-none focus:border-brand-400 disabled:opacity-40" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create session type</Button>
                  <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          )}

          {types === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : types.length === 0 && !creating ? (
            <EmptyState
              icon={<IconCalendar size={24} />}
              title="No session types yet"
              description="Create a bookable session, set your weekly availability, then publish it."
              action={<Button onClick={() => setCreating(true)}><IconPlus size={16} /> New session type</Button>}
            />
          ) : (
            <div className="space-y-3">
              {types.map((t) => (
                <Card key={t.id} padded={false} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <IconCalendar size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{t.title}</span>
                        <Badge tone={t.status === 'published' ? 'success' : 'neutral'}>{t.status}</Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                        <IconClock size={14} /> {t.durationMin} min · {t.priceCents ? formatPrice(t.priceCents, t.currency) : 'Free'}
                      </div>
                    </div>
                  </div>
                  {t.status !== 'published' && <Button variant="secondary" size="sm" onClick={() => publish(t.id)}>Publish</Button>}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default function BookingsPage() {
  return <BookingsManager />;
}
