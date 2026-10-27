import type {
  ISODateString,
  ScheduleWarning,
  TaskInput,
  WorkSession,
} from '../types/domain';

// Import our real scheduling engine
import { schedule } from './scheduler/scheduler';
import type { ScheduleInput, BusyInterval, WorkingHours } from './scheduler/contracts/scheduler-contract';

/** A task's remaining work that the scheduler could not place. */
export interface UnscheduledTask {
  taskId: string;
  taskTitle: string;
  remainingMinutes: number;
}

/** Mirrors Member B's ScheduleResult contract: sessions, unscheduled work, warnings. */
export interface ScheduleResult {
  plannedSessions: WorkSession[];
  unscheduledTasks: UnscheduledTask[];
  warnings: ScheduleWarning[];
}

/** Default fixed calendar events matching Calendar view */
export const DEFAULT_FIXED_EVENTS: BusyInterval[] = [
  {
    id: 'b1-team-meeting',
    start: '2026-09-21T08:30:00Z',
    end: '2026-09-21T09:30:00Z',
    type: 'CALENDAR_EVENT',
  },
  {
    id: 'b3-project-sync',
    start: '2026-09-22T09:00:00Z',
    end: '2026-09-22T10:00:00Z',
    type: 'CALENDAR_EVENT',
  },
  {
    id: 'b5-design-review',
    start: '2026-09-22T14:30:00Z',
    end: '2026-09-22T15:30:00Z',
    type: 'CALENDAR_EVENT',
  },
  {
    id: 'b7-client-checkin',
    start: '2026-09-23T13:30:00Z',
    end: '2026-09-23T14:30:00Z',
    type: 'CALENDAR_EVENT',
  },
];

/** Default working hours: Mon–Fri 08:00–12:00 & 13:00–17:30, Sat 08:00–11:30 */
export const DEFAULT_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
  { dayOfWeek: 1, startTime: '13:00', endTime: '17:30' },
  { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' },
  { dayOfWeek: 2, startTime: '13:00', endTime: '17:30' },
  { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
  { dayOfWeek: 3, startTime: '13:00', endTime: '17:30' },
  { dayOfWeek: 4, startTime: '08:00', endTime: '12:00' },
  { dayOfWeek: 4, startTime: '13:00', endTime: '17:30' },
  { dayOfWeek: 5, startTime: '08:00', endTime: '12:00' },
  { dayOfWeek: 5, startTime: '13:00', endTime: '17:30' },
  { dayOfWeek: 6, startTime: '08:00', endTime: '11:30' },
];

/** In-memory store for active schedule result to share between TaskList and Calendar */
let currentScheduleResult: ScheduleResult | null = null;
const listeners = new Set<() => void>();

export function getStoredScheduleResult(): ScheduleResult | null {
  if (currentScheduleResult) return currentScheduleResult;
  try {
    const raw = localStorage.getItem('app_schedule_result');
    if (raw) {
      currentScheduleResult = JSON.parse(raw);
    }
  } catch {}
  return currentScheduleResult;
}

export function setStoredScheduleResult(result: ScheduleResult | null): void {
  currentScheduleResult = result;
  try {
    if (result) {
      localStorage.setItem('app_schedule_result', JSON.stringify(result));
    } else {
      localStorage.removeItem('app_schedule_result');
    }
  } catch {}
  listeners.forEach((fn) => fn());
}

export function subscribeScheduleChanges(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Executes Member B's real Scheduling Engine with full constraints:
 * - Free Slots & buffer
 * - Topological dependency DAG
 * - Deadline and priority ranking
 * - Session splitting [min, max] & daily maximum limits
 * - Locked session preservation
 */
export function mockRunScheduler(tasks: readonly TaskInput[]): ScheduleResult {
  const taskMap = new Map<string, TaskInput>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  // Build ScheduleInput contract
  const input: ScheduleInput = {
    now: '2026-09-22T08:00:00Z', // fixed mock now for deterministic behavior
    settings: {
      planningHorizonDays: 7,
      minSessionMinutes: 30,
      maxSessionMinutes: 120,
      bufferMinutes: 15,
      dailyMaxMinutes: 360, // 6h per day
    },
    workingHours: DEFAULT_WORKING_HOURS,
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

  // Run pure core engine
  const rawResult = schedule(input);

  // Map planned sessions to WorkSession
  const plannedSessions: WorkSession[] = rawResult.plannedSessions.map((s) => ({
    id: s.id,
    taskId: s.taskId,
    taskTitle: taskMap.get(s.taskId)?.title ?? `Task ${s.taskId}`,
    start: s.start as ISODateString,
    end: s.end as ISODateString,
    isLocked: s.locked,
  }));

  // Map unscheduled tasks
  const unscheduledTasks: UnscheduledTask[] = rawResult.unscheduledTasks.map((u) => ({
    taskId: u.taskId,
    taskTitle: taskMap.get(u.taskId)?.title ?? `Task ${u.taskId}`,
    remainingMinutes: u.remainingMinutes,
  }));

  // Map warnings
  const warnings: ScheduleWarning[] = rawResult.warnings.map((w) => {
    const t = w.taskId ? taskMap.get(w.taskId) : undefined;
    return {
      code: (w.code === 'LOCKED_SESSION_CONFLICT' ? 'NO_AVAILABLE_SLOT' : w.code) as any,
      taskId: w.taskId ?? '',
      taskTitle: t?.title ?? (w.taskId ? `Task ${w.taskId}` : 'General'),
      message: w.message,
      metadata: (w.metadata ?? {}) as any,
    };
  });

  const scheduleResult: ScheduleResult = {
    plannedSessions,
    unscheduledTasks,
    warnings,
  };

  // Persist result so Calendar can render it
  setStoredScheduleResult(scheduleResult);

  return scheduleResult;
}
