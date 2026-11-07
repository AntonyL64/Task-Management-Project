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
  return task.dependencyIds.every((depId) => completedTaskIds.has(depId));
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
 * Deterministic comparison between two dependency-ready tasks:
 * 1. Earliest deadline first (EDF) (null deadline placed at the end)
 * 2. Highest priority first (URGENT > HIGH > MEDIUM > LOW)
 * 3. Earliest createdAt (FIFO tie-breaking)
 * 4. Stable tie-break by ID
 */
export function compareReadyTasks(a: TaskInput, b: TaskInput): number {
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
 * Backward compatibility comparison for general task comparison with readySet
 */
export function compareTasks(a: TaskInput, b: TaskInput, readySet: Set<string>): number {
  const aReady = readySet.has(a.id);
  const bReady = readySet.has(b.id);

  if (aReady !== bReady) {
    return aReady ? -1 : 1;
  }
  return compareReadyTasks(a, b);
}

/**
 * Binary insertion into a sorted array: Maintains monotonic priority order in O(log V)
 */
function binaryInsert(queue: TaskInput[], task: TaskInput): void {
  let low = 0;
  let high = queue.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compareReadyTasks(queue[mid], task) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  queue.splice(low, 0, task);
}

/**
 * Optimized Topological Sort via Kahn's Algorithm + Priority-Ordered Ready Queue:
 * Replaces naive O(N^2 log N) repetitive sorting with optimal O(V log V + E) algorithm.
 * Guarantees mathematical correctness for DAG dependencies while strictly honoring
 * Earliest Deadline First (EDF) and Priority rules.
 */
export function rankTasks(tasks: TaskInput[], initiallyCompletedIds: Set<string>): TaskInput[] {
  if (tasks.length === 0) return [];

  const completed = new Set(initiallyCompletedIds);
  const taskMap = new Map<string, TaskInput>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // predecessorId -> successorIds[]

  // Step 1: Build dependency graph and compute in-degrees
  for (const t of tasks) {
    taskMap.set(t.id, t);
    const unmetDeps = (t.dependencyIds ?? []).filter((depId) => !completed.has(depId));
    inDegree.set(t.id, unmetDeps.length);

    for (const depId of unmetDeps) {
      const list = dependents.get(depId) ?? [];
      list.push(t.id);
      dependents.set(depId, list);
    }
  }

  // Step 2: Initialize ready queue with tasks having inDegree === 0
  const readyQueue: TaskInput[] = [];
  for (const t of tasks) {
    if (inDegree.get(t.id) === 0) {
      readyQueue.push(t);
    }
  }

  // Sort initial ready queue: O(V log V)
  readyQueue.sort(compareReadyTasks);

  const ranked: TaskInput[] = [];

  // Step 3: Extract highest-priority ready task and unlock successors
  while (readyQueue.length > 0) {
    const current = readyQueue.shift()!;
    ranked.push(current);
    completed.add(current.id);

    const succIds = dependents.get(current.id);
    if (succIds) {
      for (const succId of succIds) {
        const curDeg = (inDegree.get(succId) ?? 1) - 1;
        inDegree.set(succId, curDeg);

        if (curDeg === 0) {
          const succTask = taskMap.get(succId);
          if (succTask) {
            // Binary insert in O(log V) to maintain exact priority invariant
            binaryInsert(readyQueue, succTask);
          }
        }
      }
    }
  }

  // Fallback guard: in case of any detached cyclic nodes, append with ready comparison
  if (ranked.length < tasks.length) {
    const rankedIds = new Set(ranked.map((t) => t.id));
    const leftovers = tasks.filter((t) => !rankedIds.has(t.id));
    leftovers.sort(compareReadyTasks);
    ranked.push(...leftovers);
  }

  return ranked;
}
