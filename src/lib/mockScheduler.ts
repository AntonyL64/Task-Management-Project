import type {
  ISODateString,
  ScheduleWarning,
  TaskInput,
  WorkSession,
} from '../types/domain';

/** A task's remaining work that the mock scheduler could not place. */
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

const MOCK_CAPACITY_MINUTES = 6 * 60;
const MAX_SESSION_MINUTES = 90;
const MIN_SESSION_MINUTES = 25;
const PRIORITY_RANK: Record<TaskInput['priority'], number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function compareTasks(a: TaskInput, b: TaskInput): number {
  // Keep this deterministic and broadly aligned with the agreed ranking rules.
  if (a.deadline && b.deadline) {
    const deadlineOrder = Date.parse(a.deadline) - Date.parse(b.deadline);
    if (deadlineOrder !== 0) return deadlineOrder;
  } else if (a.deadline) return -1;
  else if (b.deadline) return 1;

  const priorityOrder = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityOrder !== 0) return priorityOrder;
  const createdOrder = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (Number.isFinite(createdOrder) && createdOrder !== 0) return createdOrder;
  return a.id.localeCompare(b.id);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * UI-only mock. It creates sequential sessions for at most six hours, splitting
 * work into sessions of up to 90 minutes. It deliberately does not model real
 * working hours, calendar events, buffers, or locked sessions; replace this
 * function with the scheduling API once the backend contract is wired up.
 */
export function mockRunScheduler(tasks: readonly TaskInput[]): ScheduleResult {
  const plannedSessions: WorkSession[] = [];
  const unscheduledTasks: UnscheduledTask[] = [];
  const warnings: ScheduleWarning[] = [];
  const activeTasks = tasks
    .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED' && task.remainingMinutes > 0)
    .slice()
    .sort(compareTasks);

  let cursor = new Date();
  let capacityLeft = MOCK_CAPACITY_MINUTES;

  for (const task of activeTasks) {
    const requestedMinutes = Math.max(0, Math.floor(task.remainingMinutes));
    let remainingToPlace = requestedMinutes;
    let scheduledMinutes = 0;

    const dependencyTasks = task.dependencyIds
      .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
      .filter((dependency): dependency is TaskInput => Boolean(dependency));
    const blockedDependencies = dependencyTasks.filter((dependency) =>
      dependency.status !== 'DONE' && !plannedSessions.some((session) => session.taskId === dependency.id),
    );

    if (blockedDependencies.length > 0) {
      unscheduledTasks.push({ taskId: task.id, taskTitle: task.title, remainingMinutes: requestedMinutes });
      warnings.push({
        code: 'DEPENDENCY_BLOCKED',
        taskId: task.id,
        metadata: { dependencyIds: blockedDependencies.map((dependency) => dependency.id) },
      });
      continue;
    }

    while (remainingToPlace > 0 && capacityLeft > 0) {
      const sessionMinutes = Math.min(remainingToPlace, MAX_SESSION_MINUTES, capacityLeft);
      // Do not leave a tiny intermediate session; a small final remainder is OK.
      if (sessionMinutes < MIN_SESSION_MINUTES && sessionMinutes !== remainingToPlace) break;

      const start = new Date(cursor);
      const end = addMinutes(start, sessionMinutes);
      const deadlineMs = task.deadline ? Date.parse(task.deadline) : Number.POSITIVE_INFINITY;
      if (Number.isFinite(deadlineMs) && end.getTime() > deadlineMs) break;

      plannedSessions.push({
        id: `mock-session-${task.id}-${plannedSessions.length + 1}`,
        taskId: task.id,
        taskTitle: task.title,
        start: start.toISOString() as ISODateString,
        end: end.toISOString() as ISODateString,
        isLocked: false,
      });
      cursor = end;
      capacityLeft -= sessionMinutes;
      remainingToPlace -= sessionMinutes;
      scheduledMinutes += sessionMinutes;
    }

    if (remainingToPlace > 0) {
      unscheduledTasks.push({ taskId: task.id, taskTitle: task.title, remainingMinutes: remainingToPlace });
      if (task.deadline) {
        warnings.push({
          code: 'DEADLINE_RISK',
          taskId: task.id,
          metadata: {
            requiredMinutes: requestedMinutes,
            scheduledMinutes,
            missingMinutes: remainingToPlace,
            deadline: task.deadline,
          },
        });
      } else {
        warnings.push({
          code: scheduledMinutes > 0 ? 'PARTIALLY_SCHEDULED' : 'NO_AVAILABLE_SLOT',
          taskId: task.id,
          metadata: {
            requiredMinutes: requestedMinutes,
            scheduledMinutes,
            missingMinutes: remainingToPlace,
            planningHorizonDays: 1,
          },
        });
      }
    }
  }

  return { plannedSessions, unscheduledTasks, warnings };
}
