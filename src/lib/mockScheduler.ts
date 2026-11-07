import type { CalendarEvent, ISODateString, ScheduleWarning, TaskInput, WorkSession } from '../types/domain';
import { schedule } from './scheduler/scheduler';
import type { ScheduleInput, BusyInterval, WorkingHours as CoreWorkingHours } from './scheduler/contracts/scheduler-contract';

/**
 * Mock of the scheduling engine's "reschedule" call (Member B's
 * POST /api/scheduler/reschedule), so the Calendar can be built and tested
 * without the backend. Swap `mockRunScheduler` for the real service call later;
 * the Calendar only depends on this input/result shape.
 */

/* -------------------------------------------------------------------------- */
/* Types + defaults for FullCalendar View (Member C)                          */
/* -------------------------------------------------------------------------- */

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

export interface TaskConstraint {
  earliestStart?: ISODateString | null;
}

export interface MockSchedulerInput {
  now: ISODateString;
  sessions: readonly WorkSession[];
  lockedSessions?: readonly WorkSession[];
  busyEvents: readonly CalendarEvent[];
  workingHours?: WorkingHours;
  bufferMinutes?: number;
  horizonDays?: number;
  taskConstraints?: Readonly<Record<string, TaskConstraint>>;
}

export interface MockSchedulerResult {
  plannedSessions: WorkSession[];
  unscheduledSessions: WorkSession[];
  warnings: ScheduleWarning[];
}

/* -------------------------------------------------------------------------- */
/* Types for TaskList / Member B Contract                                     */
/* -------------------------------------------------------------------------- */

export interface UnscheduledTask {
  taskId: string;
  taskTitle: string;
  remainingMinutes: number;
}

export interface ScheduleResult {
  plannedSessions: WorkSession[];
  unscheduledTasks: UnscheduledTask[];
  warnings: ScheduleWarning[];
}

export const DEFAULT_FIXED_EVENTS: BusyInterval[] = [
  { id: 'b1-team-meeting', start: '2026-09-21T08:30:00Z', end: '2026-09-21T09:30:00Z', type: 'CALENDAR_EVENT' },
  { id: 'b3-project-sync', start: '2026-09-22T09:00:00Z', end: '2026-09-22T10:00:00Z', type: 'CALENDAR_EVENT' },
  { id: 'b5-design-review', start: '2026-09-22T14:30:00Z', end: '2026-09-22T15:30:00Z', type: 'CALENDAR_EVENT' },
  { id: 'b7-client-checkin', start: '2026-09-23T13:30:00Z', end: '2026-09-23T14:30:00Z', type: 'CALENDAR_EVENT' },
];

/* -------------------------------------------------------------------------- */
/* Time helpers (epoch milliseconds, UTC)                                     */
/* -------------------------------------------------------------------------- */

const MINUTE = 60_000;
const DAY = 86_400_000;
const GRID = 15 * MINUTE;

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

export function sortByStart<T extends { id: string; startAt: ISODateString }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
}

/* -------------------------------------------------------------------------- */
/* Placement (FullCalendar Mock Rescheduler)                                  */
/* -------------------------------------------------------------------------- */

interface Window {
  start: number;
  end: number;
}

function workingWindowsForDay(dayStartMs: number, hours: WorkingHours): Window[] {
  const dayOfWeek = new Date(dayStartMs).getUTCDay();
  if (!hours.daysOfWeek.includes(dayOfWeek)) return [];
  const start = dayStartMs + parseClock(hours.startTime) * MINUTE;
  const end = dayStartMs + parseClock(hours.endTime) * MINUTE;
  return end > start ? [{ start, end }] : [];
}

function findSlot(
  candidateStart: number,
  durationMs: number,
  working: readonly Window[],
  blocked: readonly Span[],
  horizonEndMs: number
): Span | null {
  let start = alignUp(candidateStart);

  while (start + durationMs <= horizonEndMs) {
    const end = start + durationMs;
    const window = working.find((w) => w.start <= start && end <= w.end);
    if (!window) {
      const next = working.find((w) => w.end > start);
      start = next ? alignUp(Math.max(next.start, start + GRID)) : alignUp(start + DAY);
      continue;
    }

    const clash = blocked.find((b) => overlaps({ start, end }, b));
    if (clash) {
      start = alignUp(clash.end);
      continue;
    }

    return { start, end };
  }

  return null;
}

export function computeReschedule(input: MockSchedulerInput): MockSchedulerResult {
  const hours = input.workingHours ?? DEFAULT_WORKING_HOURS;
  const bufferMs = (input.bufferMinutes ?? DEFAULT_BUFFER_MINUTES) * MINUTE;
  const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS;

  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error(`mockScheduler: invalid "now" (${input.now})`);
  const horizonEndMs = nowMs + horizonDays * DAY;

  const windows: Window[] = [];
  const firstDayMs = startOfUtcDay(nowMs);
  for (let d = 0; d < horizonDays + 2; d += 1) {
    windows.push(...workingWindowsForDay(firstDayMs + d * DAY, hours));
  }

  const pinned: WorkSession[] = (input.lockedSessions ?? input.sessions.filter((s) => s.isLocked)).map((s) => ({
    ...s,
    isLocked: true,
  }));

  const blocked: Span[] = [];
  for (const event of input.busyEvents) {
    const span = toSpan(event.startAt, event.endAt);
    if (span) blocked.push(span);
  }
  for (const session of pinned) {
    const span = toSpan(session.startAt, session.endAt);
    if (span) blocked.push({ start: span.start - bufferMs, end: span.end + bufferMs });
  }

  const freeSessions = input.sessions.filter((s) => !pinned.some((p) => p.id === s.id));
  const placed: WorkSession[] = [];
  const unscheduledSessions: WorkSession[] = [];
  const warnings: ScheduleWarning[] = [];

  let cursor = nowMs;

  for (const session of freeSessions) {
    const span = toSpan(session.startAt, session.endAt);
    const durationMs = span ? span.end - span.start : 60 * MINUTE;

    const constraint = input.taskConstraints?.[session.taskId];
    const earliestMs = constraint?.earliestStart ? Date.parse(constraint.earliestStart) : Number.NaN;
    const earliestStart = Number.isFinite(earliestMs) ? Math.max(nowMs, earliestMs) : nowMs;

    const candidateStart = Math.max(cursor, earliestStart);
    const slot = findSlot(candidateStart, durationMs, windows, blocked, horizonEndMs);

    if (!slot) {
      unscheduledSessions.push(session);
      warnings.push({
        code: 'NO_AVAILABLE_SLOT',
        taskId: session.taskId,
        metadata: { missingMinutes: Math.round(durationMs / MINUTE), planningHorizonDays: horizonDays },
      });
      continue;
    }

    placed.push({ ...session, startAt: toIso(slot.start), endAt: toIso(slot.end) });
    blocked.push({ start: slot.start - bufferMs, end: slot.end + bufferMs });
    cursor = slot.end;
  }

  return { plannedSessions: sortByStart([...pinned, ...placed]), unscheduledSessions, warnings };
}

/* -------------------------------------------------------------------------- */
/* Overloaded mockRunScheduler: Supports both FullCalendar & TaskList         */
/* -------------------------------------------------------------------------- */

export function mockRunScheduler(tasks: readonly TaskInput[]): ScheduleResult;
export function mockRunScheduler(
  input: MockSchedulerInput,
  options?: { latencyMs?: number }
): Promise<MockSchedulerResult>;
export function mockRunScheduler(
  arg: readonly TaskInput[] | MockSchedulerInput,
  options: { latencyMs?: number } = {}
): ScheduleResult | Promise<MockSchedulerResult> {
  if (Array.isArray(arg)) {
    // Member B's real Scheduling Engine integration for TaskList.tsx
    const tasks = arg as readonly TaskInput[];
    const taskMap = new Map<string, TaskInput>();
    for (const t of tasks) taskMap.set(t.id, t);

    const coreWorkingHours: CoreWorkingHours[] = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
    ];

    const input: ScheduleInput = {
      now: '2026-09-22T08:00:00Z',
      settings: {
        planningHorizonDays: 7,
        minSessionMinutes: 30,
        maxSessionMinutes: 120,
        bufferMinutes: 15,
        dailyMaxMinutes: 360,
      },
      workingHours: coreWorkingHours,
      busyIntervals: DEFAULT_FIXED_EVENTS,
      lockedSessions: [
        {
          id: 'locked-competitor-research',
          taskId: 't2',
          start: '2026-09-23T09:30:00Z',
          end: '2026-09-23T11:00:00Z',
        },
      ],
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        estimatedMinutes: t.estimatedMinutes,
        remainingMinutes: t.remainingMinutes,
        deadline: t.deadline,
        earliestStart: t.earliestStart ?? null,
        priority: t.priority,
        status: t.status,
        dependencyIds: t.dependencyIds,
        createdAt: t.createdAt,
      })),
    };

    const rawResult = schedule(input);

    const plannedSessions: WorkSession[] = rawResult.plannedSessions.map((s) => ({
      id: s.id,
      taskId: s.taskId,
      taskTitle: taskMap.get(s.taskId)?.title ?? `Task ${s.taskId}`,
      startAt: s.start as ISODateString,
      endAt: s.end as ISODateString,
      isLocked: s.locked,
    }));

    const unscheduledTasks: UnscheduledTask[] = rawResult.unscheduledTasks.map((u) => ({
      taskId: u.taskId,
      taskTitle: taskMap.get(u.taskId)?.title ?? `Task ${u.taskId}`,
      remainingMinutes: u.remainingMinutes,
    }));

    const warnings: ScheduleWarning[] = rawResult.warnings.map((w) => ({
      code: (w.code === 'LOCKED_SESSION_CONFLICT' ? 'NO_AVAILABLE_SLOT' : w.code) as any,
      taskId: w.taskId ?? '',
      message: w.message,
      taskTitle: w.taskId ? taskMap.get(w.taskId)?.title : undefined,
      metadata: (w.metadata ?? {}) as any,
    }));

    return { plannedSessions, unscheduledTasks, warnings };
  }

  // Member C's FullCalendar async scheduler
  const input = arg as MockSchedulerInput;
  return new Promise<MockSchedulerResult>((resolve) => {
    const result = computeReschedule(input);
    setTimeout(() => resolve(result), options.latencyMs ?? DEFAULT_LATENCY_MS);
  });
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
