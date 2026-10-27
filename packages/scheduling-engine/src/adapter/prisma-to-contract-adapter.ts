/**
 * Prisma to ScheduleInput Adapter
 * Converts relational database models (PostgreSQL / Prisma) from Member A into strictly typed ScheduleInput (Contract v2)
 */

import {
  ScheduleInput,
  TaskInput,
  BusyInterval,
  WorkingHours,
  LockedSession,
  SchedulerSettings,
  TaskPriority,
  TaskStatus,
} from '../contracts/scheduler-contract.js';

export interface PrismaUserWithScheduleContext {
  id: string;
  timezone: string;
  schedulerSetting: {
    minSessionMinutes: number;
    maxSessionMinutes: number;
    bufferMinutes: number;
    planningHorizonDays: number;
    dailyMaxMinutes: number | null;
  } | null;
  workingHours: Array<{
    weekday: number;
    startMinute: number;
    endMinute: number;
  }>;
  dayExceptions?: Array<{
    date: Date;
    isDayOff: boolean;
    slots: Array<{
      startMinute: number;
      endMinute: number;
    }>;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    remainingMinutes: number;
    deadline: Date | null;
    earliestStart: Date | null;
    priority: string;
    status: string;
    createdAt: Date;
    dependencies: Array<{ predecessorId: string }>;
  }>;
  calendarEvents: Array<{
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    recurrenceRule: string | null;
    excludedDates: Date[];
    recurringEventId: string | null;
    originalStartAt: Date | null;
  }>;
  workSessions: Array<{
    id: string;
    taskId: string;
    startAt: Date;
    endAt: Date;
    status: string;
    isLocked: boolean;
  }>;
}

/**
 * Converts integer minute of day (0..1440) to "HH:mm"
 * e.g., 480 -> "08:00", 690 -> "11:30"
 */
export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Expands weekly recurring events across the planning horizon
 */
export function expandRecurringEvents(
  events: PrismaUserWithScheduleContext['calendarEvents'],
  now: Date,
  horizonDays: number
): BusyInterval[] {
  const horizonEndMs = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  const busyList: BusyInterval[] = [];

  // Index override events by `${recurringEventId}_${originalStartAt.getTime()}`
  const overrides = new Map<string, (typeof events)[0]>();
  for (const e of events) {
    if (e.recurringEventId && e.originalStartAt) {
      const key = `${e.recurringEventId}_${new Date(e.originalStartAt).getTime()}`;
      overrides.set(key, e);
    }
  }

  for (const event of events) {
    // Skip override instances in the outer loop, they will be inserted when handling recurring occurrences
    if (event.recurringEventId) {
      continue;
    }

    if (!event.recurrenceRule) {
      // Single, non-recurring event
      const startMs = new Date(event.startAt).getTime();
      const endMs = new Date(event.endAt).getTime();
      if (endMs > now.getTime() && startMs < horizonEndMs) {
        busyList.push({
          id: event.id,
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
          type: 'CALENDAR_EVENT',
        });
      }
      continue;
    }

    // Handle RRULE (e.g. "FREQ=WEEKLY;BYDAY=MO,WE" or "FREQ=WEEKLY;BYDAY=TH;COUNT=10")
    const durationMs = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
    const eventStartDate = new Date(event.startAt);

    // Parse BYDAY from rule
    const byDayMatch = event.recurrenceRule.match(/BYDAY=([A-Z,]+)/);
    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const targetDays = byDayMatch ? byDayMatch[1].split(',').map(d => dayMap[d]) : [eventStartDate.getUTCDay()];

    // Excluded dates set
    const excludedMs = new Set(
      (event.excludedDates || []).map(d => new Date(d).getTime())
    );

    // Iterate through days in horizon
    const curDay = new Date(now);
    curDay.setUTCHours(0, 0, 0, 0);

    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const dayDate = new Date(curDay.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dayOfWeek = dayDate.getUTCDay();

      if (targetDays.includes(dayOfWeek)) {
        // Construct occurrence start time
        const occStart = new Date(dayDate);
        occStart.setUTCHours(
          eventStartDate.getUTCHours(),
          eventStartDate.getUTCMinutes(),
          eventStartDate.getUTCSeconds(),
          0
        );
        const occStartMs = occStart.getTime();
        const occEndMs = occStartMs + durationMs;

        // Check if excluded / cancelled
        if (excludedMs.has(occStartMs)) {
          continue;
        }

        // Check if overridden
        const overrideKey = `${event.id}_${occStartMs}`;
        const overrideEvent = overrides.get(overrideKey);

        if (overrideEvent) {
          busyList.push({
            id: overrideEvent.id,
            start: new Date(overrideEvent.startAt).toISOString(),
            end: new Date(overrideEvent.endAt).toISOString(),
            type: 'CALENDAR_EVENT',
          });
        } else if (occEndMs > now.getTime() && occStartMs < horizonEndMs) {
          busyList.push({
            id: `${event.id}_${occStartMs}`,
            start: new Date(occStartMs).toISOString(),
            end: new Date(occEndMs).toISOString(),
            type: 'CALENDAR_EVENT',
          });
        }
      }
    }
  }

  return busyList;
}

/**
 * Main adapter function: Converts Prisma database context into ScheduleInput
 */
export function buildScheduleInputFromPrisma(
  context: PrismaUserWithScheduleContext,
  nowIso: string
): ScheduleInput {
  const nowDate = new Date(nowIso);

  // 1. Settings
  const userSettings = context.schedulerSetting;
  const settings: SchedulerSettings = {
    planningHorizonDays: userSettings?.planningHorizonDays ?? 14,
    minSessionMinutes: userSettings?.minSessionMinutes ?? 30,
    maxSessionMinutes: userSettings?.maxSessionMinutes ?? 120,
    bufferMinutes: userSettings?.bufferMinutes ?? 10,
    dailyMaxMinutes: userSettings?.dailyMaxMinutes ?? undefined,
  };

  // 2. Working Hours
  const workingHours: WorkingHours[] = context.workingHours.map(wh => ({
    dayOfWeek: wh.weekday,
    startTime: minutesToHHmm(wh.startMinute),
    endTime: minutesToHHmm(wh.endMinute),
  }));

  // 3. Busy Intervals (including expanded recurring events & overrides)
  const busyIntervals = expandRecurringEvents(
    context.calendarEvents,
    nowDate,
    settings.planningHorizonDays
  );

  // 4. Locked Sessions (from active PLANNED sessions with isLocked === true)
  const lockedSessions: LockedSession[] = context.workSessions
    .filter(s => s.isLocked && s.status === 'PLANNED')
    .map(s => ({
      id: s.id,
      taskId: s.taskId,
      start: new Date(s.startAt).toISOString(),
      end: new Date(s.endAt).toISOString(),
    }));

  // 5. Tasks
  const tasks: TaskInput[] = context.tasks.map(t => ({
    id: t.id,
    title: t.title,
    estimatedMinutes: t.estimatedMinutes,
    remainingMinutes: t.remainingMinutes,
    deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
    earliestStart: t.earliestStart ? new Date(t.earliestStart).toISOString() : null,
    priority: t.priority as TaskPriority,
    status: t.status as TaskStatus,
    dependencyIds: t.dependencies ? t.dependencies.map(d => d.predecessorId) : [],
    createdAt: new Date(t.createdAt).toISOString(),
  }));

  return {
    now: nowIso,
    settings,
    workingHours,
    busyIntervals,
    lockedSessions,
    tasks,
  };
}
