import type { CalendarEvent, ISODateString, ScheduleWarning, TaskInput, WorkSession } from './domain';

/* -------------------------------------------------------------------------- */
/* Tasks  (Member A: /api/tasks)                                              */
/* -------------------------------------------------------------------------- */

export interface CreateTaskDto
  extends Pick<TaskInput, 'title' | 'estimatedMinutes' | 'priority'>,
    Partial<Pick<TaskInput, 'deadline' | 'earliestStart' | 'dependencyIds' | 'remainingMinutes' | 'status'>> {
  description?: string | null;
  projectId?: string;
}

export type UpdateTaskDto = Partial<Omit<TaskInput, 'id' | 'createdAt'>> & { projectId?: string };

/* -------------------------------------------------------------------------- */
/* Calendar events + working hours  (Member A)                                */
/* -------------------------------------------------------------------------- */

export type CreateCalendarEventDto = Pick<CalendarEvent, 'title' | 'startAt' | 'endAt'> &
  Partial<Pick<CalendarEvent, 'source'>>;

export interface WorkingHours {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/* -------------------------------------------------------------------------- */
/* Scheduler  (Member B: /api/scheduler)                                      */
/* -------------------------------------------------------------------------- */

export type BusyIntervalType = 'CALENDAR_EVENT' | 'EXTERNAL_EVENT' | 'OTHER';

export interface BusyInterval {
  id: string;
  start: ISODateString;
  end: ISODateString;
  type: BusyIntervalType;
}

export interface SchedulerSettings {
  planningHorizonDays: number;
  minSessionMinutes: number;
  maxSessionMinutes: number;
  bufferMinutes: number;
}

export interface ScheduleInput {
  now: ISODateString;
  tasks: TaskInput[];
  busyIntervals: BusyInterval[];
  workingHours: WorkingHours[];
  lockedSessions: WorkSession[];
  settings: SchedulerSettings;
}

export interface RescheduleInput extends ScheduleInput {
  currentSessions: WorkSession[];
}

export interface UnscheduledTask {
  taskId: string;
  unscheduledMinutes: number;
}

export interface ScheduleResult {
  plannedSessions: WorkSession[];
  unscheduledTasks: UnscheduledTask[];
  warnings: ScheduleWarning[];
}
