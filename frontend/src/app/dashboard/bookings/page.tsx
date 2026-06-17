'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import { Skeleton } from '@/components/ui';
import { Modal } from '@/components/Modal';
import {
  IconCalendar, IconClock, IconList, IconArrowLeft, IconArrowRight, IconSettings, IconX, IconChevronDown, IconChevronLeft, IconChevronRight,
} from '@/components/icons';
import { cn } from '@/lib/cn';

interface Booking { id: string; title: string; buyerEmail: string; buyerName: string; startAt: string; endAt: string; status: string; meetingUrl: string; }
interface Block { id: string; startAt: string; endAt: string; allDay: boolean; note: string; }
interface NewBlock { startIso: string; endIso: string; allDay: boolean; note: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtSlot(b: { startAt: string; endAt: string }) {
  const s = new Date(b.startAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const e = new Date(b.endAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${s} – ${e}`;
}
function fmtBlock(b: Block) {
  return b.allDay ? 'All day' : fmtSlot(b);
}
/** Blocks overlapping the local calendar day `d`, sorted by start time. */
function blocksOnDay(blocks: Block[], d: Date): Block[] {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return blocks
    .filter((b) => new Date(b.startAt) < end && new Date(b.endAt) > start)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** Purple "$" smiley empty-state illustration (shared with Income). */
function SmileyEmpty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="py-20 text-center">
      <div className="relative mx-auto mb-6 h-[104px] w-[120px]">
        <span className="absolute left-7 top-0 -rotate-[14deg] text-[30px] font-extrabold text-brand-600">$</span>
        <span className="absolute left-2 top-9 h-3 w-1 -rotate-[20deg] rounded-full bg-brand-500/70" />
        <span className="absolute right-3 top-7 h-2.5 w-1 rotate-[20deg] rounded-full bg-brand-500/70" />
        <div className="absolute bottom-0 left-1/2 grid h-[80px] w-[80px] -translate-x-1/2 place-items-center rounded-full bg-brand-600">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
            <ellipse cx="16.5" cy="18" rx="2.4" ry="4.2" fill="#fff" />
            <ellipse cx="27.5" cy="18" rx="2.4" ry="4.2" fill="#fff" />
            <path d="M14 26.5c1.8 3.2 5 3.6 8 3.6s6.2-.4 8-3.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
      <h3 className="text-2xl font-bold text-[#1a1c3a]">{title}</h3>
      <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>
    </div>
  );
}

/** Calendar / List segmented toggle + settings gear. */
function ViewToggle({
  view, onView, onSettings,
}: { view: 'list' | 'calendar'; onView: (v: 'list' | 'calendar') => void; onSettings: () => void }) {
  const items: { key: 'calendar' | 'list'; label: string; icon: typeof IconList }[] = [
    { key: 'calendar', label: 'Calendar', icon: IconCalendar },
    { key: 'list', label: 'List', icon: IconList },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {items.map((it) => {
        const active = view === it.key;
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            onClick={() => onView(it.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full text-sm transition',
              active
                ? 'bg-brand-600 px-5 py-2.5 font-bold text-white shadow-[0_4px_14px_-4px_rgba(99,85,250,0.55)]'
                : 'px-3 py-2.5 font-semibold text-[#131f60] hover:text-brand-600',
            )}
          >
            <Icon size={17} /> {it.label}
          </button>
        );
      })}
      <button
        onClick={onSettings}
        title="Booking settings"
        className="ml-1 grid h-10 w-10 place-items-center rounded-full text-neutral-400 transition hover:bg-surface-muted hover:text-ink"
      >
        <IconSettings size={20} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Day popover (calendar)                                              */
/* ------------------------------------------------------------------ */

function DayPopover({ date, bookings, blocks, openLeft, onClose, onRequestBlock, onDelete }: {
  date: Date;
  bookings: Booking[];
  blocks: Block[];
  openLeft: boolean;
  onClose: () => void;
  onRequestBlock: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute top-11 z-30 w-[320px] rounded-2xl border border-line bg-white p-4 shadow-lift',
        openLeft ? 'right-2' : 'left-2',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold text-[#1a1c3a]">{MONTHS[date.getMonth()]} {date.getDate()}</span>{' '}
          <span className="text-neutral-400">{date.toLocaleDateString('en-US', { weekday: 'long' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRequestBlock} className="text-xs font-bold text-brand-600 hover:text-brand-700">+ Block Time</button>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:bg-surface-muted hover:text-ink"><IconX size={15} /></button>
        </div>
      </div>

      {(bookings.length > 0 || blocks.length > 0) ? (
        <div className="mt-3 space-y-2 text-left">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] font-medium text-brand-700">
              {fmtSlot(b)} · {b.title || 'Session'}
            </div>
          ))}
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-[13px]">
              <span className="min-w-0 truncate text-neutral-600">
                <span className="font-semibold text-neutral-700">Blocked</span> · {fmtBlock(b)}{b.note ? ` · ${b.note}` : ''}
              </span>
              <button onClick={() => onDelete(b.id)} title="Remove block" className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-white hover:text-danger-600">
                <IconX size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 pb-2 text-center text-sm text-neutral-500">No appointments or blocked times for this day</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block Time modal                                                    */
/* ------------------------------------------------------------------ */

// 15-minute increments across the day.
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return {
    value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    label: new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
});
const TIME_LABEL = new Map(TIME_OPTIONS.map((t) => [t.value, t.label]));

function fmtDateLabel(iso: string) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** A fixed-positioned dropdown rendered through a portal so it escapes the modal's overflow. */
function FloatingPanel({ anchor, width, onClose, children }: {
  anchor: DOMRect; width?: number; onClose: () => void; children: React.ReactNode;
}) {
  const PANEL_MAX = 300;
  const openUp = anchor.bottom + 8 + PANEL_MAX > window.innerHeight && anchor.top - PANEL_MAX > 0;
  const top = openUp ? anchor.top - 8 : anchor.bottom + 8;
  const left = Math.min(anchor.left, window.innerWidth - (width ?? anchor.width) - 8);
  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', top, left, width: width ?? anchor.width, transform: openUp ? 'translateY(-100%)' : undefined }}
        className="z-[61] rounded-2xl border border-line bg-white p-3 shadow-lift"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarPopup({ value, minDate, onSelect }: { value: string; minDate?: Date; onSelect: (iso: string) => void }) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  const [cur, setCur] = useState({ year: base.getFullYear(), month: base.getMonth() });
  const min = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null;

  const lead = new Date(cur.year, cur.month, 1).getDay();
  const daysInMonth = new Date(cur.year, cur.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function shift(delta: number) {
    setCur((c) => { const m = c.month + delta; return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }; });
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <button onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-full text-brand-600 transition hover:bg-brand-50"><IconChevronLeft size={18} /></button>
        <span className="text-sm font-bold text-[#1a1c3a]">{MONTHS[cur.month]} {cur.year}</span>
        <button onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-full text-brand-600 transition hover:bg-brand-50"><IconChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-2xs font-semibold text-neutral-400">
        {WEEK_LETTERS.map((w, i) => <div key={i} className="py-1.5">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const d = new Date(cur.year, cur.month, day);
          const iso = ymd(d);
          const isPast = min ? d < min : false;
          const isSel = iso === value;
          return (
            <div key={i} className="flex justify-center">
              <button
                disabled={isPast}
                onClick={() => onSelect(iso)}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full font-semibold transition',
                  isSel ? 'bg-brand-600 text-white' : isPast ? 'cursor-not-allowed text-neutral-300' : 'text-brand-600 hover:bg-brand-50',
                )}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DateField({ value, onChange, minDate }: { value: string; onChange: (v: string) => void; minDate?: Date }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setRect(rect ? null : ref.current!.getBoundingClientRect())}
        className={cn('flex w-full items-center gap-2 rounded-xl border bg-white px-3.5 py-3 text-left transition', rect ? 'border-brand-500' : 'border-line-strong')}
      >
        <IconCalendar size={16} className="text-neutral-400" />
        <span className="text-sm text-ink">{fmtDateLabel(value)}</span>
        <IconChevronDown size={16} className="ml-auto text-neutral-400" />
      </button>
      {rect && (
        <FloatingPanel anchor={rect} width={296} onClose={() => setRect(null)}>
          <CalendarPopup value={value} minDate={minDate} onSelect={(d) => { onChange(d); setRect(null); }} />
        </FloatingPanel>
      )}
    </>
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setRect(rect ? null : ref.current!.getBoundingClientRect())}
        className={cn('flex w-full items-center gap-2 rounded-xl border bg-white px-3.5 py-3 text-left transition', rect ? 'border-brand-500' : 'border-line-strong')}
      >
        <IconClock size={16} className="text-neutral-400" />
        <span className="text-sm text-ink">{TIME_LABEL.get(value) ?? value}</span>
        <IconChevronDown size={16} className="ml-auto text-neutral-400" />
      </button>
      {rect && (
        <FloatingPanel anchor={rect} onClose={() => setRect(null)}>
          <div className="max-h-[240px] overflow-y-auto">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => { onChange(t.value); setRect(null); }}
                className={cn('block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-muted', t.value === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}

function BlockTimeModal({ open, initialDate, onClose, onSave }: {
  open: boolean;
  initialDate: Date | null;
  onClose: () => void;
  onSave: (b: NewBlock) => Promise<void>;
}) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromTime, setFromTime] = useState('09:00');
  const [toTime, setToTime] = useState('09:30');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !initialDate) return;
    const d = ymd(initialDate);
    setFromDate(d); setToDate(d); setFromTime('09:00'); setToTime('09:30'); setErr('');
  }, [open, initialDate]);

  function combine(dateStr: string, timeStr: string): Date {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = timeStr.split(':').map(Number);
    return new Date(y, mo - 1, d, h, mi, 0, 0);
  }

  async function save() {
    setErr('');
    const start = combine(fromDate, fromTime);
    const end = combine(toDate, toTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) { setErr('Pick a valid date and time.'); return; }
    if (end <= start) { setErr('The “To” time must be after the “From” time.'); return; }
    setBusy(true);
    try {
      await onSave({ startIso: start.toISOString(), endIso: end.toISOString(), allDay: false, note: '' });
      onClose();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'Could not block this time');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-[#1a1c3a]">Block Time</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
          Blocking time will result in your calendar being unavailable to book at that specific time.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-3">
        <label className="text-sm font-bold text-[#1a1c3a]">From</label>
        <label className="text-sm font-bold text-[#1a1c3a]">To</label>
        <DateField value={fromDate} onChange={setFromDate} minDate={new Date()} />
        <DateField value={toDate} onChange={setToDate} minDate={new Date()} />
        <TimeField value={fromTime} onChange={setFromTime} />
        <TimeField value={toTime} onChange={setToTime} />
      </div>

      {err && <p className="mt-3 text-center text-sm font-medium text-danger-600">{err}</p>}

      <div className="mt-7 grid grid-cols-2 gap-3">
        <button onClick={onClose} className="rounded-full bg-brand-50 py-3 text-[15px] font-bold text-brand-600 transition hover:bg-brand-100">Cancel</button>
        <button onClick={save} disabled={busy} className="rounded-full bg-brand-600 py-3 text-[15px] font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar view                                                       */
/* ------------------------------------------------------------------ */

function CalendarView({ bookings, blocks, cursor, onRequestBlock, onDeleteBlock }: {
  bookings: Booking[];
  blocks: Block[];
  cursor: { year: number; month: number };
  onRequestBlock: (date: Date) => void;
  onDeleteBlock: (id: string) => Promise<void>;
}) {
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { setSelected(null); }, [cursor.year, cursor.month]);

  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = ymd(new Date(b.startAt));
      m.set(key, [...(m.get(key) ?? []), b]);
    }
    return m;
  }, [bookings]);

  const first = new Date(cursor.year, cursor.month, 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const todayKey = ymd(today);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-line bg-[#f3f3fb] text-center text-sm font-semibold text-neutral-600">
          {DAYS.map((d) => <div key={d} className="py-3">{d}</div>)}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7" onClick={() => setSelected(null)}>
          {cells.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === cursor.month;
            const isToday = key === todayKey;
            const dayBookings = byDay.get(key) ?? [];
            const dayBlocks = blocksOnDay(blocks, d);
            const col = i % 7;
            return (
              <div
                key={i}
                onClick={(e) => { e.stopPropagation(); setSelected(selected === i ? null : i); }}
                className={cn(
                  'relative min-h-[116px] cursor-pointer border-b border-r border-line p-2 transition [&:nth-child(7n)]:border-r-0 hover:bg-surface-subtle/40',
                  !inMonth && 'bg-surface-subtle/40',
                )}
              >
                <div className="flex justify-end">
                  <span className={cn(
                    'grid h-7 w-7 place-items-center rounded-full text-sm font-semibold',
                    isToday ? 'bg-brand-600 text-white' : inMonth ? 'text-[#1a1c3a]' : 'text-neutral-300',
                  )}>
                    {String(d.getDate()).padStart(2, '0')}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {dayBookings.slice(0, 2).map((b) => (
                    <div key={b.id} className="truncate rounded-md bg-brand-50 px-1.5 py-0.5 text-2xs font-medium text-brand-700">
                      {new Date(b.startAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {b.title || 'Session'}
                    </div>
                  ))}
                  {dayBlocks.length > 0 && (
                    <div className="flex items-center gap-1.5 truncate rounded-md bg-neutral-200/70 px-2 py-1 text-2xs font-medium text-neutral-600">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
                      {dayBlocks.length} Blocked Time{dayBlocks.length > 1 ? 's' : ''}
                    </div>
                  )}
                  {dayBookings.length > 2 && <div className="px-1.5 text-2xs text-neutral-400">+{dayBookings.length - 2} more</div>}
                </div>
                {selected === i && (
                  <DayPopover
                    date={d}
                    bookings={dayBookings}
                    blocks={dayBlocks}
                    openLeft={col >= 4}
                    onClose={() => setSelected(null)}
                    onRequestBlock={() => { setSelected(null); onRequestBlock(d); }}
                    onDelete={onDeleteBlock}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List view                                                           */
/* ------------------------------------------------------------------ */

function ListView({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line text-left text-[15px] font-bold text-[#1a1c3a]">
            <th className="px-2 pb-3 font-bold">Title</th>
            <th className="px-2 pb-3 font-bold">Attendees</th>
            <th className="px-2 pb-3 font-bold">Date</th>
            <th className="px-2 pb-3 font-bold">Slot</th>
          </tr>
        </thead>
        {bookings.length > 0 && (
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-line/70 text-[15px] last:border-0 hover:bg-surface-subtle/50">
                <td className="px-2 py-4 font-bold text-[#1a1c3a]">{b.title || 'Session'}</td>
                <td className="px-2 py-4 text-neutral-500">{b.buyerName || b.buyerEmail || '—'}</td>
                <td className="whitespace-nowrap px-2 py-4 text-neutral-500">
                  {new Date(b.startAt).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
                </td>
                <td className="whitespace-nowrap px-2 py-4 text-neutral-500">{fmtSlot(b)}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {bookings.length === 0 && (
        <SmileyEmpty title="No Appointments" subtitle="You don't have any appointments scheduled yet." />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function AppointmentsContent({ initialBookings, initialBlocks }: { initialBookings?: Booking[]; initialBlocks?: Block[] }) {
  const { authedRequest } = useAuth();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [bookings, setBookings] = useState<Booking[] | null>(initialBookings ?? null);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks ?? []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [blockFor, setBlockFor] = useState<Date | null>(null);

  const createBlock = useCallback(async (payload: NewBlock) => {
    const res = await authedRequest<{ block: Block }>('/api/booking-types/blocks', {
      method: 'POST',
      body: payload,
    });
    setBlocks((prev) => [...prev, res.block]);
  }, [authedRequest]);

  const deleteBlock = useCallback(async (id: string) => {
    await authedRequest(`/api/booking-types/blocks/${id}`, { method: 'DELETE' });
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, [authedRequest]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  // Filters
  const [statusOn, setStatusOn] = useState(true); // "Status | Booked" — default active, per design
  const [titleOn, setTitleOn] = useState(false);
  const [dateOn, setDateOn] = useState(false);
  const [titleQ, setTitleQ] = useState('');
  const [dateQ, setDateQ] = useState('');

  useEffect(() => {
    if (initialBookings !== undefined) return;
    authedRequest<{ bookings: Booking[] }>('/api/booking-types/bookings')
      .then((r) => setBookings(r.bookings))
      .catch(() => setBookings([]));
    authedRequest<{ blocks: Block[] }>('/api/booking-types/blocks')
      .then((r) => setBlocks(r.blocks))
      .catch(() => {});
  }, [authedRequest, initialBookings]);

  const filtered = useMemo(() => {
    let list = bookings ?? [];
    if (titleOn && titleQ) list = list.filter((b) => (b.title || '').toLowerCase().includes(titleQ.toLowerCase()));
    if (dateOn && dateQ) list = list.filter((b) => ymd(new Date(b.startAt)) === dateQ);
    return list;
  }, [bookings, titleOn, titleQ, dateOn, dateQ]);

  function resetFilters() {
    setStatusOn(true); setTitleOn(false); setDateOn(false); setTitleQ(''); setDateQ('');
  }

  return (
    <>
      {/* Direct-deposit reminder (shown until payouts are connected) */}
      <div className="rounded-2xl bg-[#fcf6bd] px-6 py-4 text-center text-[15px] font-bold text-[#1a1c3a]">
        Heads up, customers can&apos;t purchase from you yet! Please{' '}
        <Link href="/dashboard/settings" className="underline decoration-2 underline-offset-2 hover:text-brand-700">set up your Direct Deposit</Link>{' '}
        to start selling
      </div>

      <div className="mt-5 rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,15,25,0.05)] sm:p-7">
        {(
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {view === 'calendar' ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-neutral-500 transition hover:bg-surface-muted">
                    <IconArrowLeft size={16} />
                  </button>
                  <span className="text-xl font-bold tracking-tight text-[#1a1c3a]">{MONTHS[cursor.month]} {cursor.year}</span>
                  <button onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-neutral-500 transition hover:bg-surface-muted">
                    <IconArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setTitleOn((o) => !o)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition',
                      titleOn ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}
                  >
                    <span className="text-base leading-none">{titleOn ? '×' : '+'}</span> Title
                  </button>
                  <button
                    onClick={() => setDateOn((o) => !o)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition',
                      dateOn ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100')}
                  >
                    <span className="text-base leading-none">{dateOn ? '×' : '+'}</span> Date
                  </button>
                  {statusOn && (
                    <button
                      onClick={() => setStatusOn(false)}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white"
                    >
                      <span className="text-base leading-none">×</span>
                      Status <span className="text-white/40">|</span> <span className="font-bold">Booked</span>
                    </button>
                  )}
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-bold text-[#131f60] transition hover:bg-surface-muted"
                  >
                    Reset Filters
                  </button>
                </div>
              )}

              <ViewToggle view={view} onView={setView} onSettings={() => router.push('/dashboard/settings?tab=integrations')} />
            </div>

            {/* Active filter inputs */}
            {view === 'list' && (titleOn || dateOn) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {titleOn && (
                  <input className="w-56 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-brand-500"
                    placeholder="Title contains…" value={titleQ} onChange={(e) => setTitleQ(e.target.value)} />
                )}
                {dateOn && (
                  <input type="date" className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-brand-500"
                    value={dateQ} onChange={(e) => setDateQ(e.target.value)} />
                )}
              </div>
            )}

            {/* Body */}
            <div className="mt-6">
              {bookings === null ? (
                <Skeleton className="h-64 w-full" />
              ) : view === 'list' ? (
                <ListView bookings={filtered} />
              ) : (
                <CalendarView bookings={filtered} blocks={blocks} cursor={cursor} onRequestBlock={setBlockFor} onDeleteBlock={deleteBlock} />
              )}
            </div>
          </>
        )}
      </div>

      <BlockTimeModal
        open={blockFor !== null}
        initialDate={blockFor}
        onClose={() => setBlockFor(null)}
        onSave={createBlock}
      />
    </>
  );
}

export default function BookingsPage() {
  return (
    <DashboardShell title="My Appointments" hideTitle hideSubtitle maxWidth="max-w-[1280px]">
      <AppointmentsContent />
    </DashboardShell>
  );
}
