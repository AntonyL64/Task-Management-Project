import { describe, it, expect } from 'vitest';
import { reschedule } from '../src/core/rescheduling.js';
import type { ScheduleInput, PlannedSession, BusyInterval } from '../src/contracts/scheduler-contract.js';

describe('Week 6 Rescheduling Core (Minimum Disruption & Schedule Stability)', () => {
  const baseInput: ScheduleInput = {
    now: '2026-10-19T08:00:00Z', // Monday
    settings: {
      planningHorizonDays: 5,
      minSessionMinutes: 30,
      maxSessionMinutes: 120,
      bufferMinutes: 15,
      dailyMaxMinutes: 360,
    },
    workingHours: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
    ],
    busyIntervals: [],
    lockedSessions: [],
    tasks: [
      {
        id: 'TASK-A',
        title: 'Task A (Morning Work)',
        estimatedMinutes: 120,
        remainingMinutes: 120,
        priority: 'HIGH',
        deadline: '2026-10-21T17:00:00Z',
        dependencyIds: [],
      },
      {
        id: 'TASK-B',
        title: 'Task B (Afternoon Work)',
        estimatedMinutes: 120,
        remainingMinutes: 120,
        priority: 'MEDIUM',
        deadline: '2026-10-21T17:00:00Z',
        dependencyIds: [],
      },
    ],
  };

  const initialSessions: PlannedSession[] = [
    {
      id: 'session-task-a',
      taskId: 'TASK-A',
      start: '2026-10-19T09:00:00Z',
      end: '2026-10-19T11:00:00Z',
      durationMinutes: 120,
      locked: false,
    },
    {
      id: 'session-task-b',
      taskId: 'TASK-B',
      start: '2026-10-19T13:00:00Z',
      end: '2026-10-19T15:00:00Z',
      durationMinutes: 120,
      locked: false,
    },
  ];

  it('Kịch bản 1: Cuộc họp đột xuất chèn vào - Chỉ dời session bị va chạm, giữ nguyên session khác (Minimum Disruption)', () => {
    // Cuộc họp khẩn cấp từ 09:30 đến 10:30 đè lên TASK-A (09:00 - 11:00)
    const emergencyMeeting: BusyInterval = {
      id: 'emergency-meeting',
      title: 'Họp khẩn cấp với Ban Giám hiệu',
      start: '2026-10-19T09:30:00Z',
      end: '2026-10-19T10:30:00Z',
    };

    const result = reschedule({
      currentInput: baseInput,
      existingPlannedSessions: initialSessions,
      newBusyEvent: emergencyMeeting,
      mode: 'MINIMAL_DISRUPTION',
    });

    // 1. Session của TASK-B (13:00 - 15:00) KHÔNG bị đè nên phải được GIỮ NGUYÊN (retained)
    const retainedB = result.retainedSessions.find((s) => s.taskId === 'TASK-B');
    expect(retainedB).toBeDefined();
    expect(retainedB?.start).toBe('2026-10-19T13:00:00Z');

    // 2. Session của TASK-A bị va chạm nên được dời đi (shifted)
    expect(result.shiftedSessions.length).toBeGreaterThan(0);
    const shiftedA = result.shiftedSessions.find((s) => s.session.taskId === 'TASK-A');
    expect(shiftedA).toBeDefined();
    expect(shiftedA?.reason).toBe('COLLISION_WITH_NEW_EVENT');

    // 3. Không có session nào bị xếp đè lên cuộc họp khẩn (kèm 15m buffer: 09:15 - 10:45)
    for (const session of result.plannedSessions) {
      const sStart = new Date(session.start).getTime();
      const sEnd = new Date(session.end).getTime();
      const meetingStart = new Date('2026-10-19T09:15:00Z').getTime();
      const meetingEnd = new Date('2026-10-19T10:45:00Z').getTime();

      const overlapsMeetingWithBuffer = Math.max(sStart, meetingStart) < Math.min(sEnd, meetingEnd);
      expect(overlapsMeetingWithBuffer).toBe(false);
    }
  });

  it('Kịch bản 2: Cuộc họp đột xuất đè lên phiên KHÓA (LockedSession) -> Phát cảnh báo LOCKED_SESSION_CONFLICT', () => {
    const lockedInput: ScheduleInput = {
      ...baseInput,
      lockedSessions: [
        {
          id: 'locked-session-a',
          taskId: 'TASK-A',
          start: '2026-10-19T09:00:00Z',
          end: '2026-10-19T11:00:00Z',
        },
      ],
    };

    const lockedSessionsList: PlannedSession[] = [
      {
        ...initialSessions[0],
        locked: true,
      },
      initialSessions[1],
    ];

    const emergencyMeeting: BusyInterval = {
      id: 'emergency-meeting',
      title: 'Họp đột xuất',
      start: '2026-10-19T09:30:00Z',
      end: '2026-10-19T10:30:00Z',
    };

    const result = reschedule({
      currentInput: lockedInput,
      existingPlannedSessions: lockedSessionsList,
      newBusyEvent: emergencyMeeting,
    });

    const lockedConflict = result.warnings.find((w) => w.code === 'LOCKED_SESSION_CONFLICT');
    expect(lockedConflict).toBeDefined();
    expect(lockedConflict?.taskId).toBe('TASK-A');
  });

  it('Kịch bản 3: Task hoàn thành sớm (Early Completion) -> Tự động giải phóng các future session của task đó', () => {
    const result = reschedule({
      currentInput: baseInput,
      existingPlannedSessions: initialSessions,
      taskProgressUpdates: [
        {
          taskId: 'TASK-A',
          actualMinutesSpent: 60,
          isCompleted: true, // User đánh dấu DONE sớm!
        },
      ],
    });

    // Future session của TASK-A phải bị hủy bỏ (cancelled)
    expect(result.cancelledSessions.some((s) => s.taskId === 'TASK-A')).toBe(true);

    // Trong danh sách plannedSessions mới không còn session nào của TASK-A
    const taskASessions = result.plannedSessions.filter((s) => s.taskId === 'TASK-A');
    expect(taskASessions.length).toBe(0);

    // TASK-B vẫn được bảo toàn
    const taskBSessions = result.plannedSessions.filter((s) => s.taskId === 'TASK-B');
    expect(taskBSessions.length).toBeGreaterThan(0);
  });
});
