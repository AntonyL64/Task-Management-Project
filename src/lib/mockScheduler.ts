import type { CalendarEvent, ISODateString, ScheduleWarning, WorkSession } from '../types/domain';

/**
 * Mock of the scheduling engine's "reschedule" call (Member B's
 * POST /api/scheduler/reschedule), so the Calendar can be built and tested
 * without the backend. Swap `mockRunScheduler` for the real service call later;
 * the Calendar only depends on this input/result shape.
 *
 * Rules the mock follows (all times are UTC, as stored):
 *  - INV-04 (locked preservation): a locked session is returned EXACTLY as given
 *    (same object, same start/end) and is treated as busy time.
 *  - Free sessions are re-placed at the earliest free slot that is inside the
 *    working hours, not before `now`, not before the task's `earliestStart`,
 *    and clear of every busy event and every other session.
 *  - Consecutive sessions keep a buffer between them (events need none).
 *  - Free sessions keep their relative order and their length.
 *
 * Deliberately NOT modelled: deadlines, priorities and dependencies. It works on
 * sessions, not tasks; ranking those is the real engine's job.
 */

/* -------------------------------------------------------------------------- */
/* Types + defaults                                                           */
/* -------------------------------------------------------------------------- */

/** Same shape as FullCalendar's `businessHours`, so one constant drives both the shading and the scheduler. */
export interface WorkingHours {
  /** 0 = Sunday … 6 = Saturday (UTC). */
  daysOfWeek: number[];
  /** "HH:MM", UTC. */
  startTime: string;
  endTime: string;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = { daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' };
export const DEFAULT_BUFFER_MINUTES = 15;
export const DEFAULT_HORIZON_DAYS = 28;
const DEFAULT_LATENCY_MS = 700;

/** Per-task limits the mock can honour. */
export interface TaskConstraint {
  /** The task may not be worked on before this instant. */
  earliestStart?: ISODateString | null;
}

export interface MockSchedulerInput {
  /** The scheduler's clock: nothing is planned before it. */
  now: ISODateString;
  /** Sessions to (re)place. Any with `isLocked: true` are preserved, not moved. */
  sessions: readonly WorkSession[];
  /**
   * Sessions that must stay exactly where they are (INV-04). They are returned
   * unchanged and treated as occupied time, so nothing is placed on top of them.
   */
  lockedSessions?: readonly WorkSession[];
  /** Fixed events the plan must work around. */
  busyEvents: readonly CalendarEvent[];
  workingHours?: WorkingHours;
  bufferMinutes?: number;
  /** How far ahead (from `now`) a free session may be placed. */
  horizonDays?: number;
  /** Per-task limits, keyed by taskId. */
  taskConstraints?: Readonly<Record<string, TaskConstraint>>;
}

export interface MockSchedulerResult {
  /** The complete plan: locked sessions (unchanged) + newly placed sessions, sorted by start. */
  plannedSessions: WorkSession[];
  /** Free sessions that did not fit in the horizon. They are NOT in `plannedSessions`. */
  unscheduledSessions: WorkSession[];
  warnings: ScheduleWarning[];
}

/* -------------------------------------------------------------------------- */
/* Time helpers (epoch milliseconds, UTC)                                     */
/* -------------------------------------------------------------------------- */

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Sessions start on quarter hours. */
const GRID = 15 * MINUTE;

/** Half-open interval [start, end). */
interface Span {
  start: number;
  end: number;
}

const alignUp = (ms: number) => Math.ceil(ms / GRID) * GRID;
const startOfUtcDay = (ms: number) => Math.floor(ms / DAY) * DAY;
const toIso = (ms: number): ISODateString => new Date(ms).toISOString().replace('.000Z', 'Z');

function toSpan(startAt: ISODateString, endAt: ISODateString): Span | null {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function parseClock(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`mockScheduler: invalid time "${value}" (expected HH:MM)`);
  return Number(match[1]) * 60 + Number(match[2]);
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/** Chronological order, ties by id: deterministic. */
export function sortByStart<T extends { id: string; startAt: ISODateString }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
}

/* -------------------------------------------------------------------------- */
/* Placement                                                                  */
/* -------------------------------------------------------------------------- */

/** Earliest slot of `durationMs` that is inside the working hours, after `notBefore`, and free of `blocked`. */
function findSlot(
  durationMs: number,
  notBefore: number,
  blocked: readonly Span[],
  hours: WorkingHours,
  horizonEnd: number
): Span | null {
  const opens = parseClock(hours.startTime) * MINUTE;
  const closes = parseClock(hours.endTime) * MINUTE;

  for (let dayStart = startOfUtcDay(notBefore); dayStart < horizonEnd; dayStart += DAY) {
    if (!hours.daysOfWeek.includes(new Date(dayStart).getUTCDay())) continue;

    const windowEnd = Math.min(dayStart + closes, horizonEnd);
    let start = alignUp(Math.max(dayStart + opens, notBefore));

    while (start + durationMs <= windowEnd) {
      const candidate: Span = { start, end: start + durationMs };
      const conflicts = blocked.filter((span) => overlaps(candidate, span));
      if (conflicts.length === 0) return candidate;
      // Every start before the furthest conflict's end overlaps it too, so jumping there skips nothing valid.
      start = alignUp(Math.max(...conflicts.map((span) => span.end)));
    }
  }
  return null;
}

/**
 * The scheduling itself: synchronous and pure (never mutates its input).
 * Exported for tests; the app calls `mockRunScheduler`.
 */
export function computeReschedule(input: MockSchedulerInput): MockSchedulerResult {
  const hours = input.workingHours ?? DEFAULT_WORKING_HOURS;
  const bufferMs = (input.bufferMinutes ?? DEFAULT_BUFFER_MINUTES) * MINUTE;
  const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS;

  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error(`mockScheduler: invalid "now" (${input.now})`);
  const horizonEnd = nowMs + horizonDays * DAY;

  // INV-04: whatever is pinned (explicit list, or flagged isLocked) is never moved.
  // The explicit `lockedSessions` list is authoritative: it wins if the same id also appears in `sessions`.
  const pinnedById = new Map<string, WorkSession>();
  for (const session of [...(input.lockedSessions ?? []), ...input.sessions.filter((s) => s.isLocked)]) {
    if (!pinnedById.has(session.id)) pinnedById.set(session.id, session);
  }
  const pinned = [...pinnedById.values()];
  const toPlace = input.sessions.filter((s) => !pinnedById.has(s.id));

  // Occupied time. Events need no buffer; sessions keep a buffer from other sessions.
  const blocked: Span[] = [];
  for (const event of input.busyEvents) {
    const span = toSpan(event.startAt, event.endAt);
    if (span) blocked.push(span);
  }
  for (const session of pinned) {
    const span = toSpan(session.startAt, session.endAt);
    if (span) blocked.push({ start: span.start - bufferMs, end: span.end + bufferMs });
  }

  const placed: WorkSession[] = [];
  const unscheduledSessions: WorkSession[] = [];
  const warnings: ScheduleWarning[] = [];

  // Original chronological order is kept: sessions never swap places.
  let cursor = alignUp(nowMs);
  for (const session of sortByStart(toPlace)) {
    const original = toSpan(session.startAt, session.endAt);
    if (!original) {
      unscheduledSessions.push(session);
      warnings.push({
        code: 'INVALID_TASK',
        taskId: session.taskId,
        metadata: { validationError: `Session ${session.id} has an invalid or empty time range` },
      });
      continue;
    }
    const durationMs = original.end - original.start;

    const earliest = Date.parse(input.taskConstraints?.[session.taskId]?.earliestStart ?? '');
    const notBefore = Math.max(cursor, Number.isFinite(earliest) ? alignUp(earliest) : 0);

    const slot = findSlot(durationMs, notBefore, blocked, hours, horizonEnd);
    if (!slot) {
      unscheduledSessions.push(session);
      warnings.push({
        code: 'NO_AVAILABLE_SLOT',
        taskId: session.taskId,
        metadata: { planningHorizonDays: horizonDays, missingMinutes: Math.round(durationMs / MINUTE) },
      });
      continue;
    }

    placed.push({ ...session, startAt: toIso(slot.start), endAt: toIso(slot.end) });
    blocked.push({ start: slot.start - bufferMs, end: slot.end + bufferMs });
    cursor = slot.end;
  }

  return { plannedSessions: sortByStart([...pinned, ...placed]), unscheduledSessions, warnings };
}

/**
 * Async entry point, shaped like the real HTTP call (`await`-able, can fail),
 * with an artificial delay so the UI's loading state is visible.
 */
export async function mockRunScheduler(
  input: MockSchedulerInput,
  options: { latencyMs?: number } = {}
): Promise<MockSchedulerResult> {
  const result = computeReschedule(input); // computed from the input as it is NOW
  await new Promise<void>((resolve) => setTimeout(resolve, options.latencyMs ?? DEFAULT_LATENCY_MS));
  return result;
}

/* -------------------------------------------------------------------------- */
/* Invariant checks (run by the UI before it applies ANY result)              */
/* -------------------------------------------------------------------------- */

export interface InvariantViolation {
  rule: 'INV-04' | 'OVERLAP' | 'SESSION_LOST' | 'DURATION_CHANGED';
  sessionId: string;
  message: string;
}

type TimeBlock = Pick<WorkSession, 'id' | 'startAt' | 'endAt'>;

/** INV-04: every pinned session must still be there, with the same time range, task and lock flag. */
export function findPinnedViolations(
  pinned: readonly WorkSession[],
  after: readonly WorkSession[]
): InvariantViolation[] {
  const afterById = new Map(after.map((s) => [s.id, s]));
  const violations: InvariantViolation[] = [];
  for (const before of pinned) {
    const now = afterById.get(before.id);
    if (!now) {
      violations.push({ rule: 'INV-04', sessionId: before.id, message: `locked session "${before.taskTitle}" is missing from the result` });
    } else if (
      Date.parse(now.startAt) !== Date.parse(before.startAt) ||
      Date.parse(now.endAt) !== Date.parse(before.endAt) ||
      now.taskId !== before.taskId ||
      now.isLocked !== before.isLocked
    ) {
      violations.push({ rule: 'INV-04', sessionId: before.id, message: `locked session "${before.taskTitle}" was changed` });
    }
  }
  return violations;
}

/** Placed sessions must not overlap the obstacles (events, pinned sessions) or each other. */
export function findOverlaps(placed: readonly TimeBlock[], obstacles: readonly TimeBlock[]): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const spanOf = (block: TimeBlock) => toSpan(block.startAt, block.endAt);

  placed.forEach((session, index) => {
    const span = spanOf(session);
    if (!span) return;
    const clash = [...obstacles, ...placed.slice(index + 1)].find((other) => {
      const otherSpan = spanOf(other);
      return otherSpan !== null && overlaps(span, otherSpan);
    });
    if (clash) {
      violations.push({ rule: 'OVERLAP', sessionId: session.id, message: `session ${session.id} overlaps ${clash.id}` });
    }
  });
  return violations;
}

/**
 * Everything the UI verifies about a reschedule result before applying it:
 *  - INV-04: pinned sessions are unchanged
 *  - every free session is either placed or reported as unscheduled (none lost)
 *  - placed sessions keep their length
 *  - no placed session overlaps an event, a pinned session or another placed session
 * An empty list means the result is safe to apply.
 */
export function checkRescheduleResult(args: {
  fixed: readonly WorkSession[];
  free: readonly WorkSession[];
  busyEvents: readonly CalendarEvent[];
  result: MockSchedulerResult;
}): InvariantViolation[] {
  const { fixed, free, busyEvents, result } = args;
  const fixedIds = new Set(fixed.map((s) => s.id));
  const placed = result.plannedSessions.filter((s) => !fixedIds.has(s.id));
  const violations: InvariantViolation[] = [...findPinnedViolations(fixed, result.plannedSessions)];

  const accountedIds = new Set([...placed.map((s) => s.id), ...result.unscheduledSessions.map((s) => s.id)]);
  for (const session of free) {
    if (!accountedIds.has(session.id)) {
      violations.push({ rule: 'SESSION_LOST', sessionId: session.id, message: `session ${session.id} disappeared` });
    }
  }

  const freeById = new Map(free.map((s) => [s.id, s]));
  for (const session of placed) {
    const original = freeById.get(session.id);
    const before = original && toSpan(original.startAt, original.endAt);
    const after = toSpan(session.startAt, session.endAt);
    if (!original) {
      violations.push({ rule: 'SESSION_LOST', sessionId: session.id, message: `unexpected session ${session.id} in the result` });
    } else if (before && (!after || after.end - after.start !== before.end - before.start)) {
      violations.push({ rule: 'DURATION_CHANGED', sessionId: session.id, message: `session ${session.id} changed length` });
    }
  }

  violations.push(...findOverlaps(placed, [...fixed, ...busyEvents]));
  return violations;
}
