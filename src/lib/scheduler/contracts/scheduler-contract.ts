/**
 * SCHEDULER CONTRACT VERSION 2 (Official specification between Member A and Member B)
 * Project: Personal Task Manager (HK261-DAGD1-137)
 */

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';

export interface TaskInput {
  id: string;
  title: string;
  estimatedMinutes: number;
  remainingMinutes: number;
  deadline: string | null; // ISO 8601 string or null
  earliestStart?: string | null; // ISO 8601 string or null
  priority: TaskPriority;
  status: TaskStatus;
  dependencyIds: string[]; // List of task IDs that must be completed first
  createdAt: string; // ISO 8601 string for deterministic tie-breaking
}

export type BusyIntervalType = 'CALENDAR_EVENT' | 'EXTERNAL_EVENT' | 'OTHER';

export interface BusyInterval {
  id: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  type: BusyIntervalType;
}

export interface WorkingHours {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:mm" (e.g., "08:00")
  endTime: string;   // "HH:mm" (e.g., "17:00")
}

export interface LockedSession {
  id: string;
  taskId: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

export interface SchedulerSettings {
  planningHorizonDays: number; // e.g. 7 or 14 days
  minSessionMinutes: number;   // e.g. 30 minutes
  maxSessionMinutes: number;   // e.g. 120 minutes
  bufferMinutes: number;       // Buffer applied before and after fixed busy intervals
  dailyMaxMinutes?: number;    // Maximum total planned work minutes per day (e.g. 480 mins = 8h)
  timezoneOffsetMinutes?: number; // User timezone offset from UTC in minutes (e.g. +420 for UTC+7)
}

export interface PlannedSession {
  id: string;
  taskId: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  durationMinutes: number;
  locked: boolean;
}

export type UnscheduledTaskReason =
  | 'NO_AVAILABLE_SLOT'
  | 'DEADLINE_INFEASIBLE'
  | 'DEPENDENCY_NOT_READY'
  | 'OUTSIDE_PLANNING_HORIZON'
  | 'ALREADY_COMPLETED';

export interface UnscheduledTask {
  taskId: string;
  remainingMinutes: number;
  missingMinutes: number;
  reason: UnscheduledTaskReason;
}

export type WarningCode =
  | 'PARTIALLY_SCHEDULED'
  | 'DEADLINE_RISK'
  | 'DEPENDENCY_BLOCKED'
  | 'INVALID_TASK'
  | 'LOCKED_SESSION_CONFLICT';

export interface SchedulingWarning {
  code: WarningCode;
  taskId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ScheduleInput {
  now: string; // Current timestamp in ISO 8601
  tasks: TaskInput[];
  busyIntervals: BusyInterval[];
  workingHours: WorkingHours[];
  lockedSessions: LockedSession[];
  settings: SchedulerSettings;
}

export interface ScheduleResult {
  plannedSessions: PlannedSession[];
  unscheduledTasks: UnscheduledTask[];
  warnings: SchedulingWarning[];
}

/**
 * Custom error thrown when input fails validation rules.
 */
export class InvalidScheduleInputError extends Error {
  public readonly field?: string;
  public readonly invalidValue?: unknown;

  constructor(message: string, field?: string, invalidValue?: unknown) {
    super(message);
    this.name = 'InvalidScheduleInputError';
    this.field = field;
    this.invalidValue = invalidValue;
    Object.setPrototypeOf(this, InvalidScheduleInputError.prototype);
  }
}
