import { TaskInput, TaskPriority } from '../contracts/scheduler-contract.js';

const PRIORITY_SCORES: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export interface TaskRankingContext {
  completedTaskIds: Set<string>;
  taskMap: Map<string, TaskInput>;
}

/**
 * Check if a task is ready to be scheduled based on dependencies.
 */
export function isTaskDependencyReady(
  task: TaskInput,
  completedTaskIds: Set<string>
): boolean {
  if (!task.dependencyIds || task.dependencyIds.length === 0) {
    return true;
  }
  return task.dependencyIds.every(depId => completedTaskIds.has(depId));
}

/**
 * Filter out tasks that should not be scheduled (e.g. DONE, CANCELLED, or remainingMinutes <= 0).
 */
export function filterSchedulableTasks(tasks: TaskInput[]): {
  schedulable: TaskInput[];
  alreadyDone: TaskInput[];
} {
  const schedulable: TaskInput[] = [];
  const alreadyDone: TaskInput[] = [];

  for (const t of tasks) {
    if (t.status === 'DONE' || t.status === 'CANCELLED' || t.remainingMinutes <= 0) {
      alreadyDone.push(t);
    } else {
      schedulable.push(t);
    }
  }

  return { schedulable, alreadyDone };
}

/**
 * Deterministic comparison between two tasks:
 * 1. Dependency-ready first
 * 2. Earliest deadline first (null deadline placed at the end)
 * 3. Highest priority first
 * 4. Earliest createdAt (FIFO)
 * 5. Lexicographical ID (strict stability)
 */
export function compareTasks(a: TaskInput, b: TaskInput, readySet: Set<string>): number {
  const aReady = readySet.has(a.id);
  const bReady = readySet.has(b.id);

  if (aReady !== bReady) {
    return aReady ? -1 : 1;
  }

  // 1. Deadline compare
  if (a.deadline && b.deadline) {
    const aTime = new Date(a.deadline).getTime();
    const bTime = new Date(b.deadline).getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
  } else if (a.deadline && !b.deadline) {
    return -1;
  } else if (!a.deadline && b.deadline) {
    return 1;
  }

  // 2. Priority compare
  const aPri = PRIORITY_SCORES[a.priority] ?? 0;
  const bPri = PRIORITY_SCORES[b.priority] ?? 0;
  if (aPri !== bPri) {
    return bPri - aPri; // Descending
  }

  // 3. createdAt compare
  if (a.createdAt && b.createdAt) {
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }
  }

  // 4. Stable tie-break by ID
  return a.id.localeCompare(b.id);
}

/**
 * Sorts tasks into execution candidates honoring dependencies and priority rules.
 */
export function rankTasks(tasks: TaskInput[], initiallyCompletedIds: Set<string>): TaskInput[] {
  const completed = new Set(initiallyCompletedIds);
  const remaining = [...tasks];
  const ranked: TaskInput[] = [];

  while (remaining.length > 0) {
    const readySet = new Set<string>();
    for (const t of remaining) {
      if (isTaskDependencyReady(t, completed)) {
        readySet.add(t.id);
      }
    }

    // Sort remaining tasks with current readiness
    remaining.sort((a, b) => compareTasks(a, b, readySet));

    const nextTask = remaining.shift();
    if (!nextTask) break;

    ranked.push(nextTask);
    // Speculatively mark as satisfied so downstream tasks can be sequenced
    completed.add(nextTask.id);
  }

  return ranked;
}
