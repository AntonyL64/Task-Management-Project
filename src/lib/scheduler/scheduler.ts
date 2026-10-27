import type {
  ScheduleInput,
  ScheduleResult,
} from './contracts/scheduler-contract';
import { validateScheduleInput } from './core/validator';
import {
  generateWorkingIntervals,
  convertBusyToIntervals,
  convertLockedToIntervals,
  applyBuffer,
  subtractIntervals,
  mergeIntervals,
} from './core/interval';
import { filterSchedulableTasks, rankTasks } from './core/ranking';
import { allocateSessions } from './core/allocator';

export * from './contracts/scheduler-contract';

export function schedule(input: ScheduleInput): ScheduleResult {
  validateScheduleInput(input);
  const { schedulable, alreadyDone } = filterSchedulableTasks(input.tasks);
  const initiallyCompletedIds = new Set(alreadyDone.map(t => t.id));
  const busyIntervals = convertBusyToIntervals(input.busyIntervals);
  const bufferedBusy = applyBuffer(busyIntervals, input.settings.bufferMinutes);
  const lockedIntervals = convertLockedToIntervals(input.lockedSessions);
  const blockedIntervals = mergeIntervals([...bufferedBusy, ...lockedIntervals]);

  const workingIntervals = generateWorkingIntervals(
    input.now,
    input.settings.planningHorizonDays,
    input.workingHours
  );
  const freeSlots = subtractIntervals(workingIntervals, blockedIntervals);
  const rankedTasks = rankTasks(schedulable, initiallyCompletedIds);
  const allocation = allocateSessions(
    rankedTasks,
    freeSlots,
    input.lockedSessions,
    input.settings
  );

  return {
    plannedSessions: allocation.plannedSessions,
    unscheduledTasks: allocation.unscheduledTasks,
    warnings: allocation.warnings,
  };
}
