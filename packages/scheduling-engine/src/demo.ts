import { schedule } from './scheduler.js';
import { ScheduleInput } from './contracts/scheduler-contract.js';

console.log('================================================================');
console.log('       DEMO: SCHEDULING ENGINE - PERSONAL TASK MANAGER         ');
console.log('               Đồ án HK261-DAGD1-137 (Tuần 5)                   ');
console.log('================================================================\n');

// Mock data setup
const sampleInput: ScheduleInput = {
  now: '2026-10-19T07:00:00.000Z', // Monday morning 07:00 UTC
  settings: {
    planningHorizonDays: 5,
    minSessionMinutes: 30,
    maxSessionMinutes: 120,
    bufferMinutes: 15,
    dailyMaxMinutes: 360, // Max 6 hours work per day
  },
  workingHours: [
    { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, // Monday AM
    { dayOfWeek: 1, startTime: '13:30', endTime: '17:30' }, // Monday PM
    { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' }, // Tuesday AM
    { dayOfWeek: 2, startTime: '13:30', endTime: '17:30' }, // Tuesday PM
    { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' }, // Wednesday AM
    { dayOfWeek: 3, startTime: '13:30', endTime: '17:30' }, // Wednesday PM
    { dayOfWeek: 4, startTime: '08:00', endTime: '12:00' }, // Thursday AM
    { dayOfWeek: 4, startTime: '13:30', endTime: '17:30' }, // Thursday PM
    { dayOfWeek: 5, startTime: '08:00', endTime: '12:00' }, // Friday AM
    { dayOfWeek: 5, startTime: '13:30', endTime: '17:30' }, // Friday PM
  ],
  busyIntervals: [
    {
      id: 'meeting-sync-A-C',
      start: '2026-10-20T09:00:00.000Z', // Tuesday 09:00 - 10:30
      end: '2026-10-20T10:30:00.000Z',
      type: 'CALENDAR_EVENT',
    },
  ],
  lockedSessions: [
    {
      id: 'locked-study-session',
      taskId: 'TASK-1',
      start: '2026-10-19T14:00:00.000Z',
      end: '2026-10-19T15:00:00.000Z',
    },
  ],
  tasks: [
    {
      id: 'TASK-1',
      title: 'Finalize Scheduler Contract v2 with Member A',
      estimatedMinutes: 120,
      remainingMinutes: 120,
      deadline: '2026-10-19T17:00:00.000Z',
      priority: 'URGENT',
      status: 'TODO',
      dependencyIds: [],
      createdAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'TASK-2',
      title: 'Build Interval Core & Free Slots Algorithm',
      estimatedMinutes: 180,
      remainingMinutes: 180,
      deadline: '2026-10-20T17:00:00.000Z',
      priority: 'HIGH',
      status: 'TODO',
      dependencyIds: ['TASK-1'], // Depends on Contract v2
      createdAt: '2026-10-18T10:30:00.000Z',
    },
    {
      id: 'TASK-3',
      title: 'Implement Session Allocator & Constraint Engine',
      estimatedMinutes: 240,
      remainingMinutes: 240,
      deadline: '2026-10-21T17:00:00.000Z',
      priority: 'HIGH',
      status: 'TODO',
      dependencyIds: ['TASK-2'],
      createdAt: '2026-10-18T11:00:00.000Z',
    },
    {
      id: 'TASK-4',
      title: 'Write Unit & Integration Tests (Edge Cases)',
      estimatedMinutes: 300,
      remainingMinutes: 300,
      deadline: '2026-10-22T17:00:00.000Z',
      priority: 'MEDIUM',
      status: 'TODO',
      dependencyIds: ['TASK-3'],
      createdAt: '2026-10-18T11:15:00.000Z',
    },
  ],
};

console.log('📌 Input Summary:');
console.log(`- Planning Horizon: ${sampleInput.settings.planningHorizonDays} days`);
console.log(`- Buffer Minutes: ${sampleInput.settings.bufferMinutes}m (before & after busy events)`);
console.log(`- Daily Max Work: ${sampleInput.settings.dailyMaxMinutes}m/day`);
console.log(`- Tasks to schedule: ${sampleInput.tasks.length}`);
console.log(`- Busy intervals: ${sampleInput.busyIntervals.length}`);
console.log(`- Locked sessions: ${sampleInput.lockedSessions.length}\n`);

console.log('⏳ Running schedule(input)...');
const startTime = performance.now();
const result = schedule(sampleInput);
const duration = (performance.now() - startTime).toFixed(2);
console.log(`✅ Scheduling completed in ${duration} ms\n`);

console.log('================================================================');
console.log(`📅 PLANNED SESSIONS (${result.plannedSessions.length} sessions)`);
console.log('================================================================');
console.table(
  result.plannedSessions.map(s => ({
    SessionID: s.id,
    TaskID: s.taskId,
    Start: s.start.replace('.000Z', 'Z'),
    End: s.end.replace('.000Z', 'Z'),
    Duration: `${s.durationMinutes}m`,
    Locked: s.locked ? '🔒 YES' : 'NO',
  }))
);

if (result.unscheduledTasks.length > 0) {
  console.log('\n================================================================');
  console.log(`⚠️ UNSCHEDULED TASKS (${result.unscheduledTasks.length})`);
  console.log('================================================================');
  console.table(result.unscheduledTasks);
}

if (result.warnings.length > 0) {
  console.log('\n================================================================');
  console.log(`🔔 WARNINGS (${result.warnings.length})`);
  console.log('================================================================');
  for (const w of result.warnings) {
    console.log(`- [${w.code}] Task ${w.taskId ?? 'N/A'}: ${w.message}`);
  }
}

console.log('\n✨ Demo finished successfully!');
