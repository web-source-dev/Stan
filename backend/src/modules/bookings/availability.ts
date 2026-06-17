import { DateTime } from 'luxon';
import type { BookingTypeDoc } from '../../models/Booking';
import { BookingModel, BlockedTimeModel } from '../../models/Booking';

export interface Slot {
  startIso: string; // UTC instant
  endIso: string;
}

interface ExistingBooking {
  startAt: Date;
  endAt: Date;
}

/**
 * Compute open slots for a booking type between `fromIso` and `toIso` (UTC),
 * respecting weekly windows (in the type's timezone), minimum notice, booking
 * horizon, buffers, daily cap, and existing bookings. Timezone-correct via luxon.
 */
export async function computeSlots(bt: BookingTypeDoc, fromIso?: string, toIso?: string): Promise<Slot[]> {
  const zone = bt.timezone || 'UTC';
  const now = DateTime.utc();
  const earliest = now.plus({ minutes: bt.minNoticeMin });
  const latest = now.plus({ days: bt.maxHorizonDays });

  const rangeStart = DateTime.max(earliest, fromIso ? DateTime.fromISO(fromIso, { zone: 'utc' }) : earliest);
  const rangeEnd = DateTime.min(latest, toIso ? DateTime.fromISO(toIso, { zone: 'utc' }) : latest);
  if (rangeStart >= rangeEnd) return [];

  // Buffers only apply when their toggle is enabled (the minutes can be left set
  // while the toggle is off, in which case availability must ignore them).
  const bufBefore = bt.bufferBeforeEnabled ? bt.bufferBeforeMin : 0;
  const bufAfter = bt.bufferAfterEnabled ? bt.bufferAfterMin : 0;

  // Pull existing active bookings overlapping the window (with buffer padding).
  const padMin = Math.max(bufBefore, bufAfter);
  const existing: ExistingBooking[] = await BookingModel.find({
    bookingTypeId: bt._id,
    status: { $in: ['confirmed', 'pending_payment'] },
    startAt: { $lt: rangeEnd.plus({ minutes: padMin }).toJSDate() },
    endAt: { $gt: rangeStart.minus({ minutes: padMin }).toJSDate() },
  })
    .select('startAt endAt')
    .lean();

  // Count existing bookings per local day for the daily cap.
  const perDayCount = new Map<string, number>();
  for (const b of existing) {
    const dayKey = DateTime.fromJSDate(b.startAt, { zone }).toISODate();
    if (dayKey) perDayCount.set(dayKey, (perDayCount.get(dayKey) ?? 0) + 1);
  }

  // Group sessions: several attendees share the same start instant. Bookings at
  // the exact same start are the same session (handled by the capacity check
  // below), so they must NOT count as overlap conflicts — only genuinely
  // different overlapping sessions block a candidate slot.
  const capacity = Math.max(1, bt.maxAttendees ?? 1);
  const sameStartCount = (startUtc: DateTime): number => {
    const t = startUtc.toMillis();
    return existing.filter((b) => DateTime.fromJSDate(b.startAt).toMillis() === t).length;
  };

  const conflicts = (startUtc: DateTime, endUtc: DateTime): boolean => {
    const s = startUtc.minus({ minutes: bufBefore });
    const e = endUtc.plus({ minutes: bufAfter });
    const t = startUtc.toMillis();
    return existing.some((b) => {
      const bs = DateTime.fromJSDate(b.startAt);
      if (bs.toMillis() === t) return false; // same group session — capacity handles it
      const be = DateTime.fromJSDate(b.endAt);
      return s < be && e > bs; // interval overlap (buffer applied once, to the candidate)
    });
  };

  // Creator-wide blocked intervals (vacation, one-off holds) overlapping the window.
  const blocks = await BlockedTimeModel.find({
    creatorId: bt.creatorId,
    startAt: { $lt: rangeEnd.toJSDate() },
    endAt: { $gt: rangeStart.toJSDate() },
  })
    .select('startAt endAt')
    .lean();
  const blockRanges = blocks.map((b) => ({ s: b.startAt.getTime(), e: b.endAt.getTime() }));
  const isBlocked = (startUtc: DateTime, endUtc: DateTime): boolean => {
    const s = startUtc.toMillis();
    const e = endUtc.toMillis();
    return blockRanges.some((b) => s < b.e && e > b.s);
  };

  const slots: Slot[] = [];
  const windowsByDay = new Map<number, { startMinute: number; endMinute: number }[]>();
  for (const w of bt.weeklyWindows) {
    const arr = windowsByDay.get(w.weekday) ?? [];
    arr.push({ startMinute: w.startMinute, endMinute: w.endMinute });
    windowsByDay.set(w.weekday, arr);
  }

  // Iterate each local day in the range.
  let day = rangeStart.setZone(zone).startOf('day');
  const endDay = rangeEnd.setZone(zone).endOf('day');
  const capPerDay = new Map(perDayCount);

  while (day <= endDay) {
    // luxon weekday: 1=Mon..7=Sun; our model uses 0=Sun..6=Sat.
    const modelWeekday = day.weekday % 7;
    const windows = windowsByDay.get(modelWeekday) ?? [];
    const dayKey = day.toISODate() ?? '';

    for (const w of windows) {
      let cursorMin = w.startMinute;
      while (cursorMin + bt.durationMin <= w.endMinute) {
        if (bt.dailyCap > 0 && (capPerDay.get(dayKey) ?? 0) >= bt.dailyCap) break;

        // Build the local start by setting wall-clock components in the zone
        // rather than adding minutes to midnight. Across a DST transition the day
        // is 23 or 25 hours long, so arithmetic from midnight drifts the time
        // (e.g. a 9:00 slot would land at 8:00/10:00); luxon's set() resolves the
        // correct offset for the wall-clock time instead.
        const startLocal = day.set({
          hour: Math.floor(cursorMin / 60),
          minute: cursorMin % 60,
          second: 0,
          millisecond: 0,
        });
        const startUtc = startLocal.toUTC();
        const endUtc = startUtc.plus({ minutes: bt.durationMin });

        if (
          startUtc >= rangeStart &&
          endUtc <= rangeEnd &&
          !conflicts(startUtc, endUtc) &&
          !isBlocked(startUtc, endUtc) &&
          sameStartCount(startUtc) < capacity // seats remain in this (possibly group) session
        ) {
          slots.push({ startIso: startUtc.toISO()!, endIso: endUtc.toISO()! });
        }
        cursorMin += bt.durationMin;
      }
    }
    day = day.plus({ days: 1 });
  }

  return slots;
}

/** Validate that a requested start instant is a legitimately open slot. */
export async function isSlotOpen(bt: BookingTypeDoc, startIso: string): Promise<boolean> {
  const start = DateTime.fromISO(startIso, { zone: 'utc' });
  if (!start.isValid) return false;
  const slots = await computeSlots(bt, start.toISO()!, start.plus({ minutes: bt.durationMin }).toISO()!);
  // Compare absolute instants (millis), not zoned DateTimes — luxon's equals()
  // also requires matching zones, which would always fail here.
  const target = start.toMillis();
  return slots.some((s) => DateTime.fromISO(s.startIso, { zone: 'utc' }).toMillis() === target);
}
