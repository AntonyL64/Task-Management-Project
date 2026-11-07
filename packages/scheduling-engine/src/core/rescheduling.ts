import type {
  ScheduleInput,
  ScheduleResult,
  BusyInterval,
  PlannedSession,
  SchedulingWarning,
  TaskInput,
} from '../contracts/scheduler-contract.js';
import { schedule } from '../scheduler.js';

export type RescheduleReason =
  | 'COLLISION_WITH_NEW_EVENT'
  | 'OVERDUE_INCOMPLETE_TASK'
  | 'EARLY_TASK_COMPLETION'
  | 'MANUAL_SESSION_LOCKED';

export interface ShiftedSessionInfo {
  session: PlannedSession;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
  reason: RescheduleReason;
}

export interface RescheduleRequest {
  currentInput: ScheduleInput;
  existingPlannedSessions: PlannedSession[];
  newBusyEvent?: BusyInterval;
  taskProgressUpdates?: Array<{
    taskId: string;
    actualMinutesSpent: number;
    isCompleted: boolean;
  }>;
  /** Manually locked session IDs (e.g. user dragged & locked on UI) */
  manualLockedSessionIds?: string[];
  /**
   * Rescheduling mode:
   * - 'MINIMAL_DISRUPTION' (default): Keep unaffected sessions anchored in place.
   * - 'FULL_OPTIMIZATION': Recompute all future sessions from scratch.
   */
  mode?: 'MINIMAL_DISRUPTION' | 'FULL_OPTIMIZATION';
}

export interface AdvancedRescheduleResult extends ScheduleResult {
  retainedSessions: PlannedSession[];
  shiftedSessions: ShiftedSessionInfo[];
  cancelledSessions: PlannedSession[];
  newSessions: PlannedSession[];
}

/**
 * Rescheduling Core Module (Week 6 Milestone):
 * Implements "Minimum Disruption" and "Schedule Stability" principles.
 * Avoids unnecessary re-shuffling of the entire user's week.
 */
export function reschedule(request: RescheduleRequest): AdvancedRescheduleResult {
  const {
    currentInput,
    existingPlannedSessions,
    newBusyEvent,
    taskProgressUpdates,
    manualLockedSessionIds = [],
    mode = 'MINIMAL_DISRUPTION',
  } = request;

  const nowTime = new Date(currentInput.now).getTime();
  const warnings: SchedulingWarning[] = [];
  const updatedTasks: TaskInput[] = currentInput.tasks.map((t) => ({ ...t }));
  const updatedBusy: BusyInterval[] = [...currentInput.busyIntervals];

  // 1. Add new busy event if provided
  if (newBusyEvent) {
    updatedBusy.push(newBusyEvent);
  }

  // 2. Apply task progress updates
  const completedTaskIds = new Set<string>();
  if (taskProgressUpdates) {
    for (const update of taskProgressUpdates) {
      const task = updatedTasks.find((t) => t.id === update.taskId);
      if (task) {
        if (update.isCompleted) {
          task.remainingMinutes = 0;
          task.status = 'DONE';
          completedTaskIds.add(task.id);
        } else {
          task.remainingMinutes = Math.max(0, task.remainingMinutes - update.actualMinutesSpent);
        }
      }
    }
  }

  // If Full Optimization requested, simply re-run the pure engine
  if (mode === 'FULL_OPTIMIZATION') {
    const freshResult = schedule({
      ...currentInput,
      tasks: updatedTasks,
      busyIntervals: updatedBusy,
    });

    return {
      ...freshResult,
      retainedSessions: [],
      shiftedSessions: [],
      cancelledSessions: [],
      newSessions: freshResult.plannedSessions,
    };
  }

  // =========================================================================
  // MINIMAL DISRUPTION LOGIC:
  // 1. Keep past sessions intact.
  // 2. Discard future sessions of completed tasks.
  // 3. Detect collisions between future sessions and new busy events.
  // 4. Preserve non-colliding future sessions as anchors (convert to locked).
  // 5. Re-allocate remaining work in available free slots.
  // =========================================================================

  const pastSessions: PlannedSession[] = [];
  const futureSessions: PlannedSession[] = [];
  const cancelledSessions: PlannedSession[] = [];

  for (const s of existingPlannedSessions) {
    const sEndTime = new Date(s.end).getTime();
    if (sEndTime <= nowTime) {
      pastSessions.push(s);
    } else if (completedTaskIds.has(s.taskId)) {
      cancelledSessions.push(s);
    } else {
      futureSessions.push(s);
    }
  }

  // Check collision with new busy event (including buffer)
  let newBusyStart = 0;
  let newBusyEnd = 0;
  if (newBusyEvent) {
    const bufferMs = (currentInput.settings.bufferMinutes ?? 0) * 60 * 1000;
    newBusyStart = new Date(newBusyEvent.start).getTime() - bufferMs;
    newBusyEnd = new Date(newBusyEvent.end).getTime() + bufferMs;
  }

  const manualLockSet = new Set(manualLockedSessionIds);
  const retainedSessions: PlannedSession[] = [...pastSessions];
  const collidingSessions: PlannedSession[] = [];
  const anchoredLockedSessions = [...currentInput.lockedSessions];

  for (const s of futureSessions) {
    const sStart = new Date(s.start).getTime();
    const sEnd = new Date(s.end).getTime();
    const isManualLocked = manualLockSet.has(s.id) || s.locked;

    const hasCollision =
      newBusyEvent &&
      Math.max(sStart, newBusyStart) < Math.min(sEnd, newBusyEnd);

    if (hasCollision) {
      if (isManualLocked) {
        // Warning: Collision with an immutable locked session
        warnings.push({
          code: 'LOCKED_SESSION_CONFLICT',
          taskId: s.taskId,
          message: `Sự kiện bận mới "${newBusyEvent?.id}" va chạm trực tiếp với phiên đã khóa "${s.id}". Không thể tự động dời phiên khóa này.`,
          metadata: {
            busyEventId: newBusyEvent?.id,
            lockedSessionId: s.id,
          },
        });
        retainedSessions.push(s);
      } else {
        collidingSessions.push(s);
      }
    } else {
      // Anchored: no collision, keep it stable!
      retainedSessions.push({
        ...s,
        locked: isManualLocked,
      });

      // Anchor this session so scheduler won't overwrite it
      if (!anchoredLockedSessions.some((l) => l.id === s.id)) {
        anchoredLockedSessions.push({
          id: s.id,
          taskId: s.taskId,
          start: s.start,
          end: s.end,
        });
      }
    }
  }

  // Calculate remaining unscheduled minutes for tasks with colliding sessions
  const taskToReallocateMinutes = new Map<string, number>();
  for (const cs of collidingSessions) {
    const cur = taskToReallocateMinutes.get(cs.taskId) ?? 0;
    taskToReallocateMinutes.set(cs.taskId, cur + cs.durationMinutes);
  }

  // Adjust remainingMinutes for tasks that need re-allocation
  const tasksForReschedule = updatedTasks.map((t) => {
    const minutesToReallocate = taskToReallocateMinutes.get(t.id) ?? 0;
    return {
      ...t,
      // If task has colliding minutes, ensure remainingMinutes accounts for them
      remainingMinutes: Math.max(t.remainingMinutes, minutesToReallocate),
    };
  });

  // Re-run scheduler with anchored sessions and updated busy intervals
  const rescheduleInput: ScheduleInput = {
    ...currentInput,
    busyIntervals: updatedBusy,
    lockedSessions: anchoredLockedSessions,
    tasks: tasksForReschedule,
  };

  const engineResult = schedule(rescheduleInput);

  // Identify newly scheduled sessions vs shifted sessions
  const shiftedSessions: ShiftedSessionInfo[] = [];
  const newSessions: PlannedSession[] = [];

  for (const s of engineResult.plannedSessions) {
    const isAlreadyRetained = retainedSessions.some(
      (r) => r.taskId === s.taskId && r.start === s.start && r.end === s.end
    );
    if (!isAlreadyRetained) {
      const originalCollided = collidingSessions.find((c) => c.taskId === s.taskId);
      if (originalCollided) {
        shiftedSessions.push({
          session: s,
          oldStart: originalCollided.start,
          oldEnd: originalCollided.end,
          newStart: s.start,
          newEnd: s.end,
          reason: 'COLLISION_WITH_NEW_EVENT',
        });
      } else {
        newSessions.push(s);
      }
    }
  }

  return {
    plannedSessions: engineResult.plannedSessions,
    unscheduledTasks: engineResult.unscheduledTasks,
    warnings: [...warnings, ...engineResult.warnings],
    retainedSessions,
    shiftedSessions,
    cancelledSessions,
    newSessions,
  };
}

// Keep backwards-compatibility alias
export const rescheduleOnCalendarChange = reschedule;
