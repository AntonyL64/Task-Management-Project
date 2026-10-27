import {
  ScheduleInput,
  InvalidScheduleInputError,
  TaskInput
} from '../contracts/scheduler-contract.js';

function isValidIsoDate(str: string): boolean {
  if (typeof str !== 'string' || !str.trim()) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function isValidTimeFormat(str: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(str);
  return match !== null;
}

export function validateScheduleInput(input: ScheduleInput): void {
  if (!input) {
    throw new InvalidScheduleInputError('ScheduleInput must not be null or undefined');
  }

  // 1. Validate now
  if (!isValidIsoDate(input.now)) {
    throw new InvalidScheduleInputError('Field "now" must be a valid ISO 8601 string', 'now', input.now);
  }

  // 2. Validate settings
  const { settings } = input;
  if (!settings) {
    throw new InvalidScheduleInputError('Field "settings" is required', 'settings');
  }
  if (typeof settings.planningHorizonDays !== 'number' || settings.planningHorizonDays <= 0) {
    throw new InvalidScheduleInputError('settings.planningHorizonDays must be a positive number', 'settings.planningHorizonDays', settings.planningHorizonDays);
  }
  if (typeof settings.minSessionMinutes !== 'number' || settings.minSessionMinutes <= 0) {
    throw new InvalidScheduleInputError('settings.minSessionMinutes must be a positive number', 'settings.minSessionMinutes', settings.minSessionMinutes);
  }
  if (typeof settings.maxSessionMinutes !== 'number' || settings.maxSessionMinutes < settings.minSessionMinutes) {
    throw new InvalidScheduleInputError(
      'settings.maxSessionMinutes must be greater than or equal to minSessionMinutes',
      'settings.maxSessionMinutes',
      settings.maxSessionMinutes
    );
  }
  if (typeof settings.bufferMinutes !== 'number' || settings.bufferMinutes < 0) {
    throw new InvalidScheduleInputError('settings.bufferMinutes must be a non-negative number', 'settings.bufferMinutes', settings.bufferMinutes);
  }
  if (settings.dailyMaxMinutes !== undefined && (typeof settings.dailyMaxMinutes !== 'number' || settings.dailyMaxMinutes <= 0)) {
    throw new InvalidScheduleInputError('settings.dailyMaxMinutes must be a positive number if provided', 'settings.dailyMaxMinutes', settings.dailyMaxMinutes);
  }

  // 3. Validate workingHours
  if (!Array.isArray(input.workingHours)) {
    throw new InvalidScheduleInputError('Field "workingHours" must be an array', 'workingHours');
  }
  for (const wh of input.workingHours) {
    if (typeof wh.dayOfWeek !== 'number' || wh.dayOfWeek < 0 || wh.dayOfWeek > 6) {
      throw new InvalidScheduleInputError('workingHours.dayOfWeek must be between 0 (Sunday) and 6 (Saturday)', 'dayOfWeek', wh.dayOfWeek);
    }
    if (!isValidTimeFormat(wh.startTime) || !isValidTimeFormat(wh.endTime)) {
      throw new InvalidScheduleInputError('workingHours startTime and endTime must be in "HH:mm" format', 'startTime/endTime', `${wh.startTime}-${wh.endTime}`);
    }
    if (wh.startTime >= wh.endTime) {
      throw new InvalidScheduleInputError('workingHours.startTime must be strictly before endTime', 'startTime/endTime', `${wh.startTime}-${wh.endTime}`);
    }
  }

  // 4. Validate busyIntervals
  if (!Array.isArray(input.busyIntervals)) {
    throw new InvalidScheduleInputError('Field "busyIntervals" must be an array', 'busyIntervals');
  }
  for (const b of input.busyIntervals) {
    if (!isValidIsoDate(b.start) || !isValidIsoDate(b.end)) {
      throw new InvalidScheduleInputError(`BusyInterval ${b.id} has invalid start/end ISO string`, 'busyInterval', b);
    }
    if (new Date(b.end).getTime() <= new Date(b.start).getTime()) {
      throw new InvalidScheduleInputError(`BusyInterval ${b.id} end must be strictly after start`, 'busyInterval', b);
    }
  }

  // 5. Validate lockedSessions
  if (!Array.isArray(input.lockedSessions)) {
    throw new InvalidScheduleInputError('Field "lockedSessions" must be an array', 'lockedSessions');
  }
  for (const ls of input.lockedSessions) {
    if (!isValidIsoDate(ls.start) || !isValidIsoDate(ls.end)) {
      throw new InvalidScheduleInputError(`LockedSession ${ls.id} has invalid start/end ISO string`, 'lockedSession', ls);
    }
    if (new Date(ls.end).getTime() <= new Date(ls.start).getTime()) {
      throw new InvalidScheduleInputError(`LockedSession ${ls.id} end must be strictly after start`, 'lockedSession', ls);
    }
  }

  // 6. Validate tasks
  if (!Array.isArray(input.tasks)) {
    throw new InvalidScheduleInputError('Field "tasks" must be an array', 'tasks');
  }
  const taskMap = new Map<string, TaskInput>();
  for (const task of input.tasks) {
    if (!task.id) {
      throw new InvalidScheduleInputError('Task must have a non-empty id', 'task.id', task);
    }
    if (taskMap.has(task.id)) {
      throw new InvalidScheduleInputError(`Duplicate task id detected: ${task.id}`, 'task.id', task.id);
    }
    taskMap.set(task.id, task);

    if (typeof task.remainingMinutes !== 'number' || task.remainingMinutes < 0) {
      throw new InvalidScheduleInputError(`Task ${task.id} remainingMinutes must be non-negative`, 'remainingMinutes', task.remainingMinutes);
    }
    if (typeof task.estimatedMinutes !== 'number' || task.estimatedMinutes < 0) {
      throw new InvalidScheduleInputError(`Task ${task.id} estimatedMinutes must be non-negative`, 'estimatedMinutes', task.estimatedMinutes);
    }
    if (task.deadline && !isValidIsoDate(task.deadline)) {
      throw new InvalidScheduleInputError(`Task ${task.id} deadline must be a valid ISO string or null`, 'deadline', task.deadline);
    }
    if (task.earliestStart && !isValidIsoDate(task.earliestStart)) {
      throw new InvalidScheduleInputError(`Task ${task.id} earliestStart must be a valid ISO string or null`, 'earliestStart', task.earliestStart);
    }
    if (task.dependencyIds && task.dependencyIds.includes(task.id)) {
      throw new InvalidScheduleInputError(`Task ${task.id} cannot depend on itself`, 'dependencyIds', task.dependencyIds);
    }
  }

  // 7. Cycle check in dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function checkCycle(taskId: string): void {
    visited.add(taskId);
    recursionStack.add(taskId);

    const task = taskMap.get(taskId);
    if (task && Array.isArray(task.dependencyIds)) {
      for (const depId of task.dependencyIds) {
        if (!visited.has(depId)) {
          checkCycle(depId);
        } else if (recursionStack.has(depId)) {
          throw new InvalidScheduleInputError(
            `Circular dependency detected involving task ${taskId} and ${depId}`,
            'dependencyIds',
            [taskId, depId]
          );
        }
      }
    }
    recursionStack.delete(taskId);
  }

  for (const taskId of taskMap.keys()) {
    if (!visited.has(taskId)) {
      checkCycle(taskId);
    }
  }
}
