import type {
  ISODateString,
  Project,
  ScheduleWarning,
  TaskInput,
  WorkSession,
} from '../types/domain';

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

export type User = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  role?: string;
};

export const currentUser: User = {
  id: 'u1',
  name: 'Alex Morgan',
  initials: 'AM',
  role: 'Account & working hours',
};

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Same projects (and ids) as before. `badgeClass` was replaced by `color`
 * (hex, taken from the Tempo design tokens) to match the Project DTO.
 */
export const projects: Record<string, Project> = {
  marketing: { id: 'p1', name: 'Marketing', color: '#5B5BD6' },
  discovery: { id: 'p2', name: 'Discovery', color: '#667085' },
  product: { id: 'p3', name: 'Product', color: '#168A5B' },
  strategy: { id: 'p4', name: 'Strategy', color: '#B66A09' },
  growth: { id: 'p5', name: 'Growth', color: '#5B5BD6' },
};

export function getProjectById(id: string): Project | undefined {
  return Object.values(projects).find((p) => p.id === id);
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * "Now" for the mock scenario: Tue 22 Sep 2026, 08:00 UTC. Mirrors
 * ScheduleInput.now, so every fixture below is relative to a fixed instant
 * (keeps the mock deterministic, like INV-09 requires of the scheduler).
 */
export const mockNow: ISODateString = '2026-09-22T08:00:00Z';

/**
 * TaskInput (the contract DTO, untouched) plus the project it belongs to.
 * `projectId` is a UI concern and is NOT part of the A → B contract; use
 * `toTaskInputs()` to get the pure DTOs to feed the scheduler.
 */
export interface MockTask extends TaskInput {
  projectId: string;
}

/**
 * Scenario overview (all times UTC):
 *
 *   t9  URGENT, due today ................ tight deadline, fits in one slot
 *   t4  HIGH,   due tomorrow ............. DEADLINE_RISK (not enough time)
 *   t1 → t2 → t3 ......................... dependency chain A → B → C
 *   t5  PAUSED, depends on t1 ............ paused + blocked by a prerequisite
 *   t6  earliestStart in the future ...... must not be scheduled before it
 *   t7  no deadline ...................... ranked after deadline tasks
 *   t8  DONE ............................. never scheduled
 *   t10 CANCELLED with minutes left ...... never scheduled ("no phantom work")
 */
export const mockTasks: MockTask[] = [
  // --- Dependency chain A → B → C (t1 → t2 → t3) ---------------------------
  {
    id: 't1',
    title: 'Finalize launch campaign brief',
    projectId: projects.marketing.id,
    estimatedMinutes: 240,
    remainingMinutes: 90, // ~2/3 already done
    deadline: '2026-09-25T17:00:00Z',
    earliestStart: null,
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dependencyIds: [], // chain head: ready as soon as it is ranked
    createdAt: '2026-09-14T09:00:00Z',
  },
  {
    id: 't2',
    title: 'Review landing page copy',
    projectId: projects.marketing.id,
    estimatedMinutes: 90,
    remainingMinutes: 90,
    deadline: '2026-09-26T17:00:00Z',
    earliestStart: null,
    priority: 'MEDIUM',
    status: 'TODO',
    dependencyIds: ['t1'], // B: may only start after A (t1) is planned
    createdAt: '2026-09-14T09:30:00Z',
  },
  {
    id: 't3',
    title: 'Export social media assets',
    projectId: projects.marketing.id,
    estimatedMinutes: 120,
    remainingMinutes: 120,
    deadline: '2026-09-28T17:00:00Z',
    earliestStart: null,
    priority: 'MEDIUM',
    status: 'TODO',
    dependencyIds: ['t2'], // C: only after B (t2) — transitively after A
    createdAt: '2026-09-15T10:00:00Z',
  },

  // --- Tight deadline + DEADLINE_RISK ---------------------------------------
  {
    id: 't4',
    title: 'Synthesize customer research notes',
    projectId: projects.discovery.id,
    estimatedMinutes: 600,
    remainingMinutes: 480, // needs 8h of focus time...
    deadline: '2026-09-23T17:00:00Z', // ...but is due tomorrow evening
    earliestStart: null,
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dependencyIds: [],
    createdAt: '2026-09-10T08:00:00Z',
  },
  {
    id: 't9',
    title: 'Approve vendor contract',
    projectId: projects.strategy.id,
    estimatedMinutes: 60,
    remainingMinutes: 60,
    deadline: '2026-09-22T17:00:00Z', // due TODAY; one 60-min slot is enough
    earliestStart: null,
    priority: 'URGENT',
    status: 'TODO',
    dependencyIds: [],
    createdAt: '2026-09-21T16:00:00Z',
  },

  // --- Paused task that is also waiting on a prerequisite -------------------
  {
    id: 't5',
    title: 'Prepare mobile design handoff',
    projectId: projects.product.id,
    estimatedMinutes: 180,
    remainingMinutes: 72, // 60% done before being paused
    deadline: '2026-09-30T17:00:00Z',
    earliestStart: null,
    priority: 'HIGH',
    status: 'PAUSED', // contract does not say if PAUSED is scheduled: confirm with B
    dependencyIds: ['t1'], // second dependent of t1 (not a chain)
    createdAt: '2026-09-12T11:00:00Z',
  },

  // --- Future earliestStart --------------------------------------------------
  {
    id: 't6',
    title: 'Define Q4 success metrics',
    projectId: projects.strategy.id,
    estimatedMinutes: 120,
    remainingMinutes: 120,
    deadline: '2026-10-02T17:00:00Z',
    earliestStart: '2026-09-28T09:00:00Z', // Mon 28 Sep: never plan before this
    priority: 'MEDIUM',
    status: 'TODO',
    dependencyIds: [],
    createdAt: '2026-09-16T09:00:00Z',
  },

  // --- No deadline -----------------------------------------------------------
  {
    id: 't7',
    title: 'Audit onboarding email sequence',
    projectId: projects.growth.id,
    estimatedMinutes: 90,
    remainingMinutes: 90,
    deadline: null, // no deadline → ranked after every task that has one
    earliestStart: null,
    priority: 'LOW',
    status: 'TODO',
    dependencyIds: [],
    createdAt: '2026-09-18T14:00:00Z',
  },

  // --- Terminal states: must never get sessions (INV-10) --------------------
  {
    id: 't8',
    title: 'Share sprint retrospective summary',
    projectId: projects.product.id,
    estimatedMinutes: 45,
    remainingMinutes: 0, // finished
    deadline: '2026-10-05T17:00:00Z',
    earliestStart: null,
    priority: 'LOW',
    status: 'DONE',
    dependencyIds: [],
    createdAt: '2026-09-11T10:00:00Z',
  },
  {
    id: 't10',
    title: 'Outline October newsletter',
    projectId: projects.growth.id,
    estimatedMinutes: 60,
    remainingMinutes: 60, // minutes left on purpose: CANCELLED must still be skipped
    deadline: null,
    earliestStart: null,
    priority: 'LOW',
    status: 'CANCELLED',
    dependencyIds: [],
    createdAt: '2026-09-17T09:00:00Z',
  },
];

/** Strip UI-only fields, leaving the exact DTO list for ScheduleInput.tasks. */
export function toTaskInputs(tasks: readonly MockTask[]): TaskInput[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    estimatedMinutes: t.estimatedMinutes,
    remainingMinutes: t.remainingMinutes,
    deadline: t.deadline,
    earliestStart: t.earliestStart,
    priority: t.priority,
    status: t.status,
    dependencyIds: [...t.dependencyIds],
    createdAt: t.createdAt,
  }));
}

export function getTaskById(id: string): MockTask | undefined {
  return mockTasks.find((t) => t.id === id);
}

/* -------------------------------------------------------------------------- */
/* Planned sessions + warnings (a plausible ScheduleResult for the tasks)     */
/* -------------------------------------------------------------------------- */

function requireTask(id: string): MockTask {
  const task = getTaskById(id);
  if (!task) {
    throw new Error(`mockData: unknown task id "${id}"`);
  }
  return task;
}

function session(
  id: string,
  taskId: string,
  start: ISODateString,
  end: ISODateString,
  isLocked = false
): WorkSession {
  return { id, taskId, taskTitle: requireTask(taskId).title, start, end, startAt: start, endAt: end, isLocked };
}

/**
 * Assumes working hours 09:00–17:00 Mon–Fri and a 15-minute buffer between
 * sessions (the Settings page defaults). Ordered chronologically, no overlaps.
 */
export const mockSessions: WorkSession[] = [
  // t9 — 60 of 60 min, on time (due 22 Sep 17:00)
  session('s1', 't9', '2026-09-22T09:00:00Z', '2026-09-22T10:00:00Z'),

  // t4 — only 300 of 480 min fit before 23 Sep 17:00 → DEADLINE_RISK.
  // (Assume the rest of 23 Sep is blocked by busy events, not modelled here.)
  session('s2', 't4', '2026-09-22T10:15:00Z', '2026-09-22T12:15:00Z'),
  session('s3', 't4', '2026-09-22T13:00:00Z', '2026-09-22T15:00:00Z', true), // pinned by the user
  session('s4', 't4', '2026-09-23T09:00:00Z', '2026-09-23T10:00:00Z'),

  // t1 — 90 of 90 min (chain head)
  session('s5', 't1', '2026-09-23T10:15:00Z', '2026-09-23T11:45:00Z'),

  // t2 — starts after t1's last session ends
  session('s6', 't2', '2026-09-24T09:00:00Z', '2026-09-24T10:30:00Z'),

  // t3 — starts after t2; split into two 60-min sessions
  session('s7', 't3', '2026-09-24T10:45:00Z', '2026-09-24T11:45:00Z'),
  session('s8', 't3', '2026-09-25T09:00:00Z', '2026-09-25T10:00:00Z'),

  // t6 — not before its earliestStart (28 Sep 09:00)
  session('s9', 't6', '2026-09-28T09:00:00Z', '2026-09-28T11:00:00Z'),

  // t7 — no deadline, so it is placed last
  session('s10', 't7', '2026-09-29T09:00:00Z', '2026-09-29T10:30:00Z'),

  // t5 (PAUSED), t8 (DONE) and t10 (CANCELLED) intentionally have no sessions.
];

/** One DEADLINE_RISK warning: t4 needs 480 min but only 300 were placed. */
export const mockWarnings: ScheduleWarning[] = [
  {
    code: 'DEADLINE_RISK',
    taskId: 't4',
    metadata: {
      requiredMinutes: 480,
      scheduledMinutes: 300,
      missingMinutes: 180,
    },
  },
];
