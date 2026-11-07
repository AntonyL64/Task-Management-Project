/**
 * Request / response types of the REST API (Member A's CRUD endpoints and
 * Member B's scheduler endpoints).
 *
 * Entities such as TaskInput, CalendarEvent, WorkSession and ScheduleWarning
 * live in ./domain.ts and are reused here, not redefined. All timestamps are
 * ISO-8601 UTC strings with a "Z" suffix (RSK-02): the frontend converts to
 * local time only for display.
 *
 * Where a shape comes from:
 *  - BusyInterval, WorkingHours, SchedulerSettings: Member B's contract
 *    (progress report, weeks 1–2, §4.2–4.3).
 *  - ScheduleInput / ScheduleResult: same report, §3 (lockedSessions follows
 *    domain.ts, i.e. WorkSession[]).
 *  - UnscheduledTask and RescheduleInput: NOT spelled out in any document yet.
 *    They are marked "inferred" below; confirm them with Member B.
 */

import type { CalendarEvent, ISODateString, ScheduleWarning, TaskInput, WorkSession } from './domain';

/* -------------------------------------------------------------------------- */
/* Tasks  (Member A: /api/tasks)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Body of POST /api/tasks. The server assigns `id` and `createdAt`.
 * Omit `remainingMinutes` and `status` to let the server default them
 * (assumed: remainingMinutes = estimatedMinutes, status = a "not started" value).
 */
export interface CreateTaskDto
  extends Pick<TaskInput, 'title' | 'estimatedMinutes' | 'priority'>,
    Partial<Pick<TaskInput, 'description' | 'deadline' | 'earliestStart' | 'dependencyIds' | 'remainingMinutes' | 'status'>> {
  /** Project the task belongs to. Not part of TaskInput (the scheduler never sees it). */
  projectId?: string;
}

/** Body of PATCH /api/tasks/:id: any subset of the editable fields (`id` and `createdAt` are immutable). */
export type UpdateTaskDto = Partial<Omit<TaskInput, 'id' | 'createdAt'>> & { projectId?: string };

/* -------------------------------------------------------------------------- */
/* Calendar events + working hours  (Member A)                                */
/* -------------------------------------------------------------------------- */

/** Body of POST /api/calendar/events. The server assigns `id`. */
export type CreateCalendarEventDto = Pick<CalendarEvent, 'title' | 'startAt' | 'endAt'> &
  Partial<Pick<CalendarEvent, 'source'>>;

/**
 * Working hours of ONE weekday. A user has one entry per working day; days
 * without an entry are days off.
 */
export interface WorkingHours {
  /** 0..6. The report does not say which day is 0; JavaScript / FullCalendar use 0 = Sunday. */
  dayOfWeek: number;
  /** "HH:mm" (24-hour). */
  startTime: string;
  /** "HH:mm" (24-hour). */
  endTime: string;
}

/* -------------------------------------------------------------------------- */
/* Scheduler  (Member B: /api/scheduler)                                      */
/* -------------------------------------------------------------------------- */

export type BusyIntervalType = 'CALENDAR_EVENT' | 'EXTERNAL_EVENT' | 'OTHER';

/**
 * A fixed block of time the user is busy ("I'm busy"). It only blocks time and
 * is not tied to a task. Field names follow the contract v0.1 report
 * (`start`/`end`); domain.ts renamed WorkSession to startAt/endAt, so if
 * contract v2 did the same here, change it in this one place.
 */
export interface BusyInterval {
  id: string;
  start: ISODateString;
  end: ISODateString;
  type: BusyIntervalType;
}

/** Tuning knobs of the scheduler (contract §4.3). */
export interface SchedulerSettings {
  /** How far ahead (from `now`) work is planned. */
  planningHorizonDays: number;
  minSessionMinutes: number;
  maxSessionMinutes: number;
  /** Gap kept between consecutive sessions. */
  bufferMinutes: number;
}

/**
 * Everything the scheduling core needs. It is a pure function of this input
 * (INV-09: same input, same output).
 */
export interface ScheduleInput {
  /** The scheduler's clock: nothing is planned before it. */
  now: ISODateString;
  tasks: TaskInput[];
  busyIntervals: BusyInterval[];
  workingHours: WorkingHours[];
  /**
   * Sessions the user pinned (`isLocked: true`). They keep their exact start/end
   * (INV-04), block time like a busy interval, and count toward their task's work.
   */
  lockedSessions: WorkSession[];
  settings: SchedulerSettings;
}

/**
 * Input of a reschedule: a normal ScheduleInput plus the plan being repaired.
 * INFERRED (not in the report): rescheduling follows Minimum Disruption
 * (RSK-03), so the engine has to know the CURRENT sessions to keep the ones
 * that are unaffected. Confirm the field name with Member B.
 */
export interface RescheduleInput extends ScheduleInput {
  currentSessions: WorkSession[];
}

/**
 * A task that could not be (fully) planned. INFERRED from INV-06 ("scheduled
 * duration + unscheduled duration = remainingMinutes"): the report names
 * `unscheduledTasks` without spelling out its shape.
 */
export interface UnscheduledTask {
  taskId: string;
  unscheduledMinutes: number;
}

/** What the scheduler returns (contract v2). */
export interface ScheduleResult {
  /** The plan. Locked sessions are returned unchanged. */
  plannedSessions: WorkSession[];
  unscheduledTasks: UnscheduledTask[];
  /** Machine-readable reasons (deadline risk, no slot…). The UI turns them into messages. */
  warnings: ScheduleWarning[];
}
