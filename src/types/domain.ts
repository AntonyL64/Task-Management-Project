/**
 * Domain types for the Personal Task Management & Auto-Scheduling system.
 *
 * Source of truth: Member B's DTO contract (progress report, weeks 1–2,
 * section 4 "TaskInput" and section 8 "Warning / Reason vocabulary").
 * Do NOT rename or reshape the fields below without agreeing it with
 * Member B first — the scheduling core consumes TaskInput as-is.
 */

/**
 * ISO 8601 timestamp WITH an offset or "Z", e.g. "2026-09-25T17:00:00Z".
 * The contract (open question Q5) proposes ISO 8601 with offset; the core
 * converts to epoch internally. Plain alias (not branded) to keep mock data
 * easy to write, but every date field in this file uses it for clarity.
 */
export type ISODateString = string;

/**
 * Task priority. Used by the scheduler only as a tie-break AFTER dependency
 * readiness and deadline (rank order: URGENT > HIGH > MEDIUM > LOW).
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Task lifecycle status.
 * - DONE and CANCELLED tasks must never produce sessions (invariant INV-10).
 */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';

/**
 * A task as seen by the Scheduling Core (the A → B contract).
 */
export interface TaskInput {
  id: string;
  title: string;

  /** Original estimate in minutes. Informational; the scheduler ignores it. */
  estimatedMinutes: number;

  /**
   * Work still to be scheduled, in minutes. THIS is what the scheduler uses
   * (not estimatedMinutes). A task with remainingMinutes = 0 gets no sessions.
   */
  remainingMinutes: number;

  /**
   * Hard due date. Sessions counted as "on time" must end at or before it.
   * `null` = no deadline; such tasks are ranked after tasks that have one.
   */
  deadline: ISODateString | null;

  /**
   * Earliest moment work may start. The scheduler never places a session
   * before it. `null` or omitted = can start immediately.
   * (Optional in the contract: `earliestStart?: string | null`.)
   */
  earliestStart?: ISODateString | null;

  priority: Priority;
  status: TaskStatus;

  /**
   * IDs of prerequisite tasks (finish-to-start). A task is only schedulable
   * once its prerequisites are planned. Cycles are invalid input (EC-11).
   */
  dependencyIds: string[];

  /** Creation time. Tie-break used by task ranking after deadline/priority. */
  createdAt: ISODateString;
}

/**
 * Warning / reason codes returned by the Scheduling Core. The core returns a
 * code plus metadata; the UI decides the human-readable message.
 *
 * - DEADLINE_RISK:            not enough free time before the deadline.
 * - PARTIALLY_SCHEDULED:      only part of the remaining work could be placed.
 * - NO_AVAILABLE_SLOT:        no usable slot inside the planning horizon.
 * - DEPENDENCY_BLOCKED:       a prerequisite prevents scheduling the task.
 * - OUTSIDE_PLANNING_HORIZON: earliestStart/deadline lies beyond the horizon.
 * - INVALID_TASK:             task data failed validation.
 */
export type WarningCode =
  | 'DEADLINE_RISK'
  | 'PARTIALLY_SCHEDULED'
  | 'NO_AVAILABLE_SLOT'
  | 'DEPENDENCY_BLOCKED'
  | 'OUTSIDE_PLANNING_HORIZON'
  | 'INVALID_TASK';

/**
 * Suggested metadata per warning code (contract section 8). Every field is
 * optional because each code only uses a subset.
 */
export interface WarningMetadata {
  /** DEADLINE_RISK: minutes that would be needed before the deadline. */
  requiredMinutes?: number;
  /** DEADLINE_RISK / PARTIALLY_SCHEDULED: minutes actually placed. */
  scheduledMinutes?: number;
  /** DEADLINE_RISK / PARTIALLY_SCHEDULED: minutes that did not fit. */
  missingMinutes?: number;
  /** NO_AVAILABLE_SLOT: size of the horizon that was searched. */
  planningHorizonDays?: number;
  /** DEPENDENCY_BLOCKED: the prerequisite task IDs holding this task back. */
  dependencyIds?: string[];
  /** OUTSIDE_PLANNING_HORIZON: the offending dates. */
  earliestStart?: ISODateString | null;
  deadline?: ISODateString | null;
  /** INVALID_TASK: what failed validation. */
  validationError?: string;
}

/**
 * One entry of ScheduleResult.warnings[]. Not listed in the DTO section, but
 * needed to attach a WarningCode to a task; shape follows contract section 8.
 */
export interface ScheduleWarning {
  code: WarningCode;
  taskId: string;
  message?: string;
  taskTitle?: string;
  metadata: WarningMetadata;
}

/** A project used to group tasks and colour their tags in the UI. */
export interface Project {
  id: string;
  name: string;
  /** CSS hex colour (e.g. "#5B5BD6") used for the project's tag/badge. */
  color: string;
}

/**
 * A block of work the scheduler placed on the calendar (an entry of
 * ScheduleResult.plannedSessions[]).
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startAt: ISODateString;
  endAt: ISODateString;
  source?: 'INTERNAL' | 'GOOGLE' | 'ICS' | 'OUTLOOK' | 'LOCAL';
  isHardBusy?: boolean;
}

export interface WorkSession {
  id: string;
  taskId: string;
  /** Denormalised from the task so the calendar can render without a lookup. */
  taskTitle: string;
  start?: ISODateString;
  end?: ISODateString;
  startAt: ISODateString;
  endAt: ISODateString;
  /**
   * `true` = the user pinned this session. Rescheduling must keep its
   * start/end unchanged (INV-04) and it still counts toward the task's work.
   */
  isLocked: boolean;
}
