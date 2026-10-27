import type {
  TaskInput,
  SchedulerSettings,
  PlannedSession,
  UnscheduledTask,
  SchedulingWarning,
  LockedSession,
  UnscheduledTaskReason
} from '../contracts/scheduler-contract';
import { msToMinutes, minutesToMs } from './interval';
import type { TimeInterval } from './interval';
interface MutableSlot {
  startMs: number;
  endMs: number;
}

function getDayKey(dateMs: number): string {
  const d = new Date(dateMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface AllocationResult {
  plannedSessions: PlannedSession[];
  unscheduledTasks: UnscheduledTask[];
  warnings: SchedulingWarning[];
}

export function allocateSessions(
  rankedTasks: TaskInput[],
  initialFreeSlots: TimeInterval[],
  lockedSessions: LockedSession[],
  settings: SchedulerSettings
): AllocationResult {
  const plannedSessions: PlannedSession[] = [];
  const unscheduledTasks: UnscheduledTask[] = [];
  const warnings: SchedulingWarning[] = [];

  // Track daily planned minutes: dayKey -> total minutes planned
  const dailyUsage = new Map<string, number>();

  // 1. Incorporate locked sessions into plannedSessions and deduct from dailyUsage & task remaining
  const taskRemaining = new Map<string, number>();
  for (const t of rankedTasks) {
    taskRemaining.set(t.id, t.remainingMinutes);
  }

  for (const ls of lockedSessions) {
    const startMs = new Date(ls.start).getTime();
    const endMs = new Date(ls.end).getTime();
    const duration = msToMinutes(endMs - startMs);

    plannedSessions.push({
      id: ls.id,
      taskId: ls.taskId,
      start: ls.start,
      end: ls.end,
      durationMinutes: duration,
      locked: true,
    });

    const dayKey = getDayKey(startMs);
    dailyUsage.set(dayKey, (dailyUsage.get(dayKey) ?? 0) + duration);

    if (taskRemaining.has(ls.taskId)) {
      const cur = taskRemaining.get(ls.taskId)!;
      taskRemaining.set(ls.taskId, Math.max(0, cur - duration));
    }
  }

  // Work with a mutable copy of free slots
  const freeSlots: MutableSlot[] = initialFreeSlots.map(s => ({
    startMs: s.startMs,
    endMs: s.endMs,
  }));

  // Track completion time for dependencies
  const taskCompletionTime = new Map<string, number>();
  // Seed with locked sessions
  for (const ls of lockedSessions) {
    const endMs = new Date(ls.end).getTime();
    const curEnd = taskCompletionTime.get(ls.taskId) ?? 0;
    if (endMs > curEnd) {
      taskCompletionTime.set(ls.taskId, endMs);
    }
  }

  const sessionCounters = new Map<string, number>();

  // 2. Iterate through ranked tasks
  for (const task of rankedTasks) {
    let remaining = taskRemaining.get(task.id) ?? task.remainingMinutes;
    const initialRemaining = remaining;

    if (remaining <= 0) {
      continue;
    }

    // Determine earliest allowed start time based on task.earliestStart and dependencies
    let allowedStartMs = task.earliestStart ? new Date(task.earliestStart).getTime() : 0;
    if (task.dependencyIds && task.dependencyIds.length > 0) {
      for (const depId of task.dependencyIds) {
        const depEnd = taskCompletionTime.get(depId);
        if (depEnd !== undefined && depEnd > allowedStartMs) {
          allowedStartMs = depEnd;
        }
      }
    }

    const deadlineMs = task.deadline ? new Date(task.deadline).getTime() : Infinity;

    // Scan free slots
    for (let i = 0; i < freeSlots.length && remaining > 0; i++) {
      const slot = freeSlots[i];
      if (slot.startMs >= slot.endMs) continue;

      // Candidate window within this slot
      const windowStart = Math.max(slot.startMs, allowedStartMs);
      const windowEnd = Math.min(slot.endMs, deadlineMs);

      if (windowEnd <= windowStart) {
        continue;
      }

      const availableMinsInSlot = msToMinutes(windowEnd - windowStart);
      if (availableMinsInSlot < settings.minSessionMinutes) {
        continue;
      }

      // Check daily maximum limit
      const dayKey = getDayKey(windowStart);
      const currentDayMins = dailyUsage.get(dayKey) ?? 0;
      let maxAllowedToday = Infinity;
      if (settings.dailyMaxMinutes !== undefined) {
        maxAllowedToday = Math.max(0, settings.dailyMaxMinutes - currentDayMins);
      }

      if (maxAllowedToday < settings.minSessionMinutes) {
        continue; // Cannot schedule any session of minimum duration today
      }

      // Determine session duration
      const candidateDuration = Math.min(
        remaining,
        settings.maxSessionMinutes,
        availableMinsInSlot,
        maxAllowedToday
      );

      if (candidateDuration < settings.minSessionMinutes) {
        continue;
      }

      // Allocate session
      const sessionStartMs = windowStart;
      const sessionEndMs = sessionStartMs + minutesToMs(candidateDuration);

      const count = (sessionCounters.get(task.id) ?? 0) + 1;
      sessionCounters.set(task.id, count);

      plannedSessions.push({
        id: `${task.id}-session-${count}`,
        taskId: task.id,
        start: new Date(sessionStartMs).toISOString(),
        end: new Date(sessionEndMs).toISOString(),
        durationMinutes: candidateDuration,
        locked: false,
      });

      // Update counters
      remaining -= candidateDuration;
      dailyUsage.set(dayKey, currentDayMins + candidateDuration);
      taskCompletionTime.set(task.id, Math.max(taskCompletionTime.get(task.id) ?? 0, sessionEndMs));

      // Carve out allocated time from slot
      if (sessionStartMs === slot.startMs) {
        slot.startMs = sessionEndMs;
      } else {
        // Session started after slot start, split slot
        const oldEnd = slot.endMs;
        slot.endMs = sessionStartMs;
        if (sessionEndMs < oldEnd) {
          freeSlots.splice(i + 1, 0, {
            startMs: sessionEndMs,
            endMs: oldEnd,
          });
        }
      }
    }

    taskRemaining.set(task.id, remaining);

    // 3. Handle unscheduled or partially scheduled tasks
    if (remaining > 0) {
      let reason: UnscheduledTaskReason = 'NO_AVAILABLE_SLOT';
      if (task.deadline && new Date(task.deadline).getTime() <= new Date().getTime()) {
        reason = 'DEADLINE_INFEASIBLE';
      }

      unscheduledTasks.push({
        taskId: task.id,
        remainingMinutes: remaining,
        missingMinutes: remaining,
        reason,
      });

      if (remaining < initialRemaining) {
        warnings.push({
          code: 'PARTIALLY_SCHEDULED',
          taskId: task.id,
          message: `Task ${task.title} was only partially scheduled (${initialRemaining - remaining}/${initialRemaining} mins).`,
          metadata: {
            requiredMinutes: initialRemaining,
            scheduledMinutes: initialRemaining - remaining,
            missingMinutes: remaining,
          },
        });
      } else {
        warnings.push({
          code: 'DEADLINE_RISK',
          taskId: task.id,
          message: `Task ${task.title} could not be scheduled within available slots before deadline.`,
          metadata: {
            missingMinutes: remaining,
          },
        });
      }
    }
  }

  // Sort plannedSessions chronologically
  plannedSessions.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    plannedSessions,
    unscheduledTasks,
    warnings,
  };
}
