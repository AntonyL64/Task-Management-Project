import apiClient from './apiClient';
import type { RequestOptions } from './apiClient';
import type { RescheduleInput, ScheduleInput, ScheduleResult } from '../types/api';

/**
 * Scheduling (Member B's NestJS module, which wraps the scheduling core).
 *
 * Routes are relative to the client's base URL, which already ends in `/api`.
 * All timestamps are ISO-8601 UTC strings ("…Z"). Both calls need a logged-in
 * user (JWT) and reject with `ApiError`.
 *
 * Planning many tasks can take a while, so these calls wait up to
 * SCHEDULER_TIMEOUT_MS (the default for other calls is shorter).
 */
export const SCHEDULER_TIMEOUT_MS = 60_000;

export const schedulerService = {
  /**
   * Plans all remaining work from scratch: splits tasks into sessions and places
   * them in free time, respecting deadlines, dependencies and working hours.
   * Sessions in `lockedSessions` are kept exactly as they are (INV-04).
   *
   * `POST /api/scheduler/auto-schedule`
   *
   * @param input The tasks, busy time, working hours, locked sessions and settings.
   * @param options.signal Aborts the request.
   * @returns The plan (`plannedSessions`), the work that did not fit
   *          (`unscheduledTasks`) and the reasons (`warnings`, e.g. DEADLINE_RISK).
   * @throws {ApiError} 400/422 invalid input (e.g. an invalid task or a dependency cycle);
   *         401 not logged in; `kind: 'timeout'` if planning takes longer than SCHEDULER_TIMEOUT_MS.
   */
  async autoSchedule(input: ScheduleInput, options?: RequestOptions): Promise<ScheduleResult> {
    const response = await apiClient.post<ScheduleResult>('/scheduler/auto-schedule', input, {
      signal: options?.signal,
      timeout: SCHEDULER_TIMEOUT_MS,
    });
    return response.data;
  },

  /**
   * Repairs an existing plan after something changed (a new busy event, a task
   * edit…) with minimum disruption: only sessions that are affected move, and
   * locked sessions never move (INV-04).
   *
   * `POST /api/scheduler/reschedule`
   *
   * @param input A normal `ScheduleInput` plus `currentSessions`, the plan to repair.
   * @param options.signal Aborts the request.
   * @returns The repaired plan, in the same shape as `autoSchedule`.
   * @throws {ApiError} 400/422 invalid input; 401 not logged in;
   *         `kind: 'timeout'` if planning takes longer than SCHEDULER_TIMEOUT_MS.
   */
  async reschedule(input: RescheduleInput, options?: RequestOptions): Promise<ScheduleResult> {
    const response = await apiClient.post<ScheduleResult>('/scheduler/reschedule', input, {
      signal: options?.signal,
      timeout: SCHEDULER_TIMEOUT_MS,
    });
    return response.data;
  },
};
