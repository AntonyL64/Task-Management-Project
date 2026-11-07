import type { WorkingHours, BusyInterval, LockedSession } from '../contracts/scheduler-contract.js';

export interface TimeInterval {
  startMs: number;
  endMs: number;
  startIso?: string;
  endIso?: string;
}

export function msToMinutes(ms: number): number {
  return Math.floor(ms / (1000 * 60));
}

export function minutesToMs(mins: number): number {
  return mins * 60 * 1000;
}

/**
 * Merge overlapping or directly contiguous intervals.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  // Sort by startMs ascending, then endMs ascending
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: TimeInterval[] = [];

  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.startMs <= current.endMs) {
      // Overlapping or touching
      current.endMs = Math.max(current.endMs, next.endMs);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Expand busy intervals with a buffer before and after.
 */
export function applyBuffer(intervals: TimeInterval[], bufferMinutes: number): TimeInterval[] {
  if (bufferMinutes <= 0) return intervals;
  const bufferMs = minutesToMs(bufferMinutes);

  const expanded = intervals.map(inv => ({
    startMs: inv.startMs - bufferMs,
    endMs: inv.endMs + bufferMs,
  }));

  return mergeIntervals(expanded);
}

/**
 * Generate working interval windows across the planning horizon starting from `now`.
 * Supports optional timezoneOffsetMinutes (e.g. +420 for UTC+7) to convert user's
 * local clock working hours into exact UTC epoch intervals without temporal drift.
 */
export function generateWorkingIntervals(
  nowIso: string,
  horizonDays: number,
  workingHours: WorkingHours[],
  timezoneOffsetMinutes: number = 0
): TimeInterval[] {
  if (workingHours.length === 0) return [];

  const nowDate = new Date(nowIso);
  const nowMs = nowDate.getTime();
  const intervals: TimeInterval[] = [];

  const offsetMs = timezoneOffsetMinutes * 60 * 1000;

  // Start from the calendar date of `now` in user's local timeline
  const localNowDate = new Date(nowMs + offsetMs);
  const curLocalDayUtc = new Date(Date.UTC(
    localNowDate.getUTCFullYear(),
    localNowDate.getUTCMonth(),
    localNowDate.getUTCDate()
  ));

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const d = new Date(curLocalDayUtc.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...

    const matchingWh = workingHours.filter((wh) => wh.dayOfWeek === dayOfWeek);

    for (const wh of matchingWh) {
      const [startH, startM] = wh.startTime.split(':').map(Number);
      const [endH, endM] = wh.endTime.split(':').map(Number);

      const localWinStartMs = d.getTime() + (startH * 60 + startM) * 60 * 1000;
      const localWinEndMs = d.getTime() + (endH * 60 + endM) * 60 * 1000;

      // Translate back to absolute UTC epoch
      const utcWinStartMs = localWinStartMs - offsetMs;
      const utcWinEndMs = localWinEndMs - offsetMs;

      const winStartMs = Math.max(nowMs, utcWinStartMs);
      const winEndMs = utcWinEndMs;

      if (winEndMs > winStartMs) {
        intervals.push({
          startMs: winStartMs,
          endMs: winEndMs,
        });
      }
    }
  }

  return mergeIntervals(intervals);
}

/**
 * Subtract blocked intervals (busy events, buffer, locked sessions) from source working intervals.
 * Returns the exact list of available Free Slots.
 */
export function subtractIntervals(
  sourceIntervals: TimeInterval[],
  blockedIntervals: TimeInterval[]
): TimeInterval[] {
  if (sourceIntervals.length === 0) return [];
  if (blockedIntervals.length === 0) return [...sourceIntervals];

  const mergedBlocked = mergeIntervals(blockedIntervals);
  const freeSlots: TimeInterval[] = [];

  for (const src of sourceIntervals) {
    let currentStart = src.startMs;
    const sourceEnd = src.endMs;

    for (const blk of mergedBlocked) {
      if (blk.endMs <= currentStart) {
        // Block is completely before current position
        continue;
      }
      if (blk.startMs >= sourceEnd) {
        // Block is completely after current window
        break;
      }

      // Block overlaps with [currentStart, sourceEnd]
      if (blk.startMs > currentStart) {
        freeSlots.push({
          startMs: currentStart,
          endMs: Math.min(blk.startMs, sourceEnd),
        });
      }

      currentStart = Math.max(currentStart, blk.endMs);
      if (currentStart >= sourceEnd) {
        break;
      }
    }

    if (currentStart < sourceEnd) {
      freeSlots.push({
        startMs: currentStart,
        endMs: sourceEnd,
      });
    }
  }

  return freeSlots;
}

/**
 * Helper to convert BusyIntervals and LockedSessions to TimeInterval[]
 */
export function convertBusyToIntervals(busy: BusyInterval[]): TimeInterval[] {
  return busy.map(b => ({
    startMs: new Date(b.start).getTime(),
    endMs: new Date(b.end).getTime(),
    startIso: b.start,
    endIso: b.end,
  }));
}

export function convertLockedToIntervals(locked: LockedSession[]): TimeInterval[] {
  return locked.map(l => ({
    startMs: new Date(l.start).getTime(),
    endMs: new Date(l.end).getTime(),
    startIso: l.start,
    endIso: l.end,
  }));
}
