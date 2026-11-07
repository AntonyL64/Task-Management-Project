import type { CalendarEvent, Project, WorkSession } from '../types/domain';
import { projects } from './mockData';
import type { TaskConstraint } from './mockScheduler';

/**
 * Calendar fixtures for the demo scenario (week of Mon 21 Sep 2026, "now" =
 * Tue 22 Sep 08:00 UTC). All times are UTC and are shown as written because
 * the Calendar view defaults to timeZone="UTC".
 *
 * They tell the same story as mockTasks / mockWarnings:
 *  - On Wed 23 Sep the external events fill the afternoon, which is why
 *    "Synthesize customer research notes" (t4) only gets 300 of 480 minutes
 *    before its deadline (DEADLINE_RISK).
 *  - Work sessions respect the 15-minute buffer and the 09:00–17:00 working hours.
 *
 * Replace with real data (ScheduleResult.plannedSessions + imported events)
 * once the API is wired up.
 */

/** Fixed events that the scheduler must work around (meetings, imported calendars). */
export const mockCalendarEvents: CalendarEvent[] = [
  { id: 'e1', title: 'Weekly planning', startAt: '2026-09-21T09:00:00Z', endAt: '2026-09-21T10:00:00Z', source: 'INTERNAL' },
  { id: 'e2', title: 'Team stand-up', startAt: '2026-09-22T08:30:00Z', endAt: '2026-09-22T09:00:00Z', source: 'INTERNAL' },
  { id: 'e3', title: 'Design review', startAt: '2026-09-22T15:30:00Z', endAt: '2026-09-22T16:30:00Z', source: 'GOOGLE' },
  { id: 'e4', title: 'Lunch & learn', startAt: '2026-09-23T11:45:00Z', endAt: '2026-09-23T13:00:00Z', source: 'ICS' },
  { id: 'e5', title: 'Client workshop — Northstar', startAt: '2026-09-23T13:00:00Z', endAt: '2026-09-23T16:00:00Z', source: 'GOOGLE' },
  { id: 'e6', title: 'All-hands', startAt: '2026-09-23T16:00:00Z', endAt: '2026-09-23T17:00:00Z', source: 'GOOGLE' },
  { id: 'e7', title: 'Project sync', startAt: '2026-09-24T13:00:00Z', endAt: '2026-09-24T14:00:00Z', source: 'INTERNAL' },
  { id: 'e8', title: 'Sprint retro', startAt: '2026-09-25T15:00:00Z', endAt: '2026-09-25T16:00:00Z', source: 'INTERNAL' },
  { id: 'e9', title: 'Roadmap review', startAt: '2026-09-29T14:00:00Z', endAt: '2026-09-29T15:00:00Z', source: 'ICS' },
];

/** Sessions placed by the scheduler. Titles mirror the matching entries of mockTasks. */
export const mockCalendarSessions: WorkSession[] = [
  { id: 's1', taskId: 't9', taskTitle: 'Approve vendor contract', startAt: '2026-09-22T09:00:00Z', endAt: '2026-09-22T10:00:00Z', isLocked: false },
  { id: 's2', taskId: 't4', taskTitle: 'Synthesize customer research notes', startAt: '2026-09-22T10:15:00Z', endAt: '2026-09-22T12:15:00Z', isLocked: false },
  { id: 's3', taskId: 't4', taskTitle: 'Synthesize customer research notes', startAt: '2026-09-22T13:00:00Z', endAt: '2026-09-22T15:00:00Z', isLocked: true },
  { id: 's4', taskId: 't4', taskTitle: 'Synthesize customer research notes', startAt: '2026-09-23T09:00:00Z', endAt: '2026-09-23T10:00:00Z', isLocked: false },
  { id: 's5', taskId: 't1', taskTitle: 'Finalize launch campaign brief', startAt: '2026-09-23T10:15:00Z', endAt: '2026-09-23T11:45:00Z', isLocked: false },
  { id: 's6', taskId: 't2', taskTitle: 'Review landing page copy', startAt: '2026-09-24T09:00:00Z', endAt: '2026-09-24T10:30:00Z', isLocked: false },
  { id: 's7', taskId: 't3', taskTitle: 'Export social media assets', startAt: '2026-09-24T10:45:00Z', endAt: '2026-09-24T11:45:00Z', isLocked: false },
  { id: 's8', taskId: 't3', taskTitle: 'Export social media assets', startAt: '2026-09-25T09:00:00Z', endAt: '2026-09-25T10:00:00Z', isLocked: false },
  { id: 's9', taskId: 't6', taskTitle: 'Define Q4 success metrics', startAt: '2026-09-28T09:00:00Z', endAt: '2026-09-28T11:00:00Z', isLocked: false },
  { id: 's10', taskId: 't7', taskTitle: 'Audit onboarding email sequence', startAt: '2026-09-29T09:00:00Z', endAt: '2026-09-29T10:30:00Z', isLocked: false },
];

/** Which project each demo task belongs to (mirrors `projectId` on the matching entries of mockTasks). */
const TASK_PROJECT: Readonly<Record<string, Project>> = {
  t1: projects.marketing,
  t2: projects.marketing,
  t3: projects.marketing,
  t4: projects.discovery,
  t6: projects.strategy,
  t7: projects.growth,
  t9: projects.strategy,
};

/** Resolves a session's task to its project (for the badge). Swap for a real lookup once tasks come from the API. */
export function getMockProjectForTask(taskId: string): Project | undefined {
  return TASK_PROJECT[taskId];
}

/** Task-level limits the mock scheduler honours (mirrors `earliestStart` on the matching entries of mockTasks). */
export const mockTaskConstraints: Readonly<Record<string, TaskConstraint>> = {
  t6: { earliestStart: '2026-09-28T09:00:00Z' },
};
