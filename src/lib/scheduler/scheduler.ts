import type {
  ScheduleInput,
  ScheduleResult,
} from './contracts/scheduler-contract.js';
import { validateScheduleInput } from './core/validator.js';
import {
  generateWorkingIntervals,
  convertBusyToIntervals,
  convertLockedToIntervals,
  applyBuffer,
  subtractIntervals,
  mergeIntervals,
} from './core/interval.js';
import { filterSchedulableTasks, rankTasks } from './core/ranking.js';
import { allocateSessions } from './core/allocator.js';

export * from './contracts/scheduler-contract.js';

/**
 * Main Scheduling Engine Pipeline:
 * Implements Deterministic Rule-Based Hybrid Scheduling algorithm.
 * Pure function: No side effects, no database dependency.
 *
 * @param input ScheduleInput strictly formatted according to Contract v2
 * @returns ScheduleResult containing plannedSessions, unscheduledTasks, and warnings
 * @throws InvalidScheduleInputError if input validation fails
 */
export function schedule(input: ScheduleInput): ScheduleResult {
  // Step 1: Input Validation
  validateScheduleInput(input);

  // Step 2: Filter tasks (separate active from done/cancelled)
  const { schedulable, alreadyDone } = filterSchedulableTasks(input.tasks);
  const initiallyCompletedIds = new Set(alreadyDone.map(t => t.id));

  // Step 3: Compute Blocked Timeline
  // 3a. Busy intervals with buffer
  const busyIntervals = convertBusyToIntervals(input.busyIntervals);
  const bufferedBusy = applyBuffer(busyIntervals, input.settings.bufferMinutes);

  // 3b. Locked sessions (fixed in time)
  const lockedIntervals = convertLockedToIntervals(input.lockedSessions);

  // 3c. Combined blocked intervals
  const blockedIntervals = mergeIntervals([...bufferedBusy, ...lockedIntervals]);

  // Step 4: Generate Working Hours Windows (timezone-aware)
  const workingIntervals = generateWorkingIntervals(
    input.now,
    input.settings.planningHorizonDays,
    input.workingHours,
    input.settings.timezoneOffsetMinutes ?? 0
  );

  // Step 5: Subtract blocked time from working hours to obtain Free Slots
  const freeSlots = subtractIntervals(workingIntervals, blockedIntervals);

  // Step 6: Topological & Priority Ranking
  const rankedTasks = rankTasks(schedulable, initiallyCompletedIds);

  // Step 7: Allocate Sessions
  const allocation = allocateSessions(
    rankedTasks,
    freeSlots,
    input.lockedSessions,
    input.settings
  );

  // Step 8: Return normalized result
  return {
    plannedSessions: allocation.plannedSessions,
    unscheduledTasks: allocation.unscheduledTasks,
    warnings: allocation.warnings,
  };
}
