import { describe, it, expect } from 'vitest';
import { schedule } from '../src/scheduler.js';
import { ScheduleInput, InvalidScheduleInputError } from '../src/contracts/scheduler-contract.js';
import { mergeIntervals, applyBuffer, subtractIntervals } from '../src/core/interval.js';

describe('1. Interval Core & Free Slots (Thuật toán tìm khoảng trống)', () => {
  it('phải gộp chính xác các khoảng thời gian bận trùng nhau hoặc nối tiếp', () => {
    const raw = [
      { startMs: 100, endMs: 200 },
      { startMs: 150, endMs: 250 },
      { startMs: 300, endMs: 400 },
      { startMs: 400, endMs: 500 }, // nối tiếp
    ];
    const merged = mergeIntervals(raw);
    expect(merged).toEqual([
      { startMs: 100, endMs: 250 },
      { startMs: 300, endMs: 500 },
    ]);
  });

  it('phải mở rộng thời gian đệm (bufferMinutes) trước và sau sự kiện cố định', () => {
    const busy = [{ startMs: 60 * 60 * 1000, endMs: 120 * 60 * 1000 }];
    const buffered = applyBuffer(busy, 15); // Đệm 15 phút
    expect(buffered).toHaveLength(1);
    expect(buffered[0].startMs).toBe((60 - 15) * 60 * 1000);
    expect(buffered[0].endMs).toBe((120 + 15) * 60 * 1000);
  });

  it('phải trừ khoảng bận khỏi giờ làm việc để tìm Free Slots chính xác', () => {
    const working = [{ startMs: 0, endMs: 1000 }];
    const blocked = [{ startMs: 200, endMs: 400 }, { startMs: 600, endMs: 700 }];
    const free = subtractIntervals(working, blocked);
    expect(free).toEqual([
      { startMs: 0, endMs: 200 },
      { startMs: 400, endMs: 600 },
      { startMs: 700, endMs: 1000 },
    ]);
  });
});

describe('2. Validation & Error Handling (Bắt lỗi đầu vào phòng thủ)', () => {
  it('phải ném InvalidScheduleInputError khi maxSession < minSession', () => {
    const badInput: any = {
      now: '2026-10-19T08:00:00Z',
      settings: {
        planningHorizonDays: 7,
        minSessionMinutes: 60,
        maxSessionMinutes: 30, // Lỗi: max < min
        bufferMinutes: 0,
      },
      workingHours: [],
      busyIntervals: [],
      lockedSessions: [],
      tasks: [],
    };

    expect(() => schedule(badInput)).toThrowError(InvalidScheduleInputError);
  });

  it('phải phát hiện chu trình phụ thuộc vòng tròn giữa các task (Circular Dependency)', () => {
    const cycleInput: ScheduleInput = {
      now: '2026-10-19T08:00:00Z',
      settings: {
        planningHorizonDays: 7,
        minSessionMinutes: 30,
        maxSessionMinutes: 60,
        bufferMinutes: 0,
      },
      workingHours: [{ dayOfWeek: 1, startTime: '08:00', endTime: '17:00' }],
      busyIntervals: [],
      lockedSessions: [],
      tasks: [
        {
          id: 'A',
          title: 'Task A',
          estimatedMinutes: 60,
          remainingMinutes: 60,
          deadline: null,
          priority: 'HIGH',
          status: 'TODO',
          dependencyIds: ['B'],
          createdAt: '2026-10-18T00:00:00Z',
        },
        {
          id: 'B',
          title: 'Task B',
          estimatedMinutes: 60,
          remainingMinutes: 60,
          deadline: null,
          priority: 'HIGH',
          status: 'TODO',
          dependencyIds: ['A'], // Vòng lặp A -> B -> A
          createdAt: '2026-10-18T00:00:00Z',
        },
      ],
    };

    expect(() => schedule(cycleInput)).toThrow(/Circular dependency/);
  });
});

describe('3. End-to-End Scheduling Pipeline (Chạy toàn diện theo Contract v2)', () => {
  it('phải phân bổ phiên làm việc tuân thủ giờ làm việc, quan hệ phụ thuộc và phiên khóa', () => {
    const input: ScheduleInput = {
      now: '2026-10-19T07:00:00.000Z',
      settings: {
        planningHorizonDays: 2,
        minSessionMinutes: 30,
        maxSessionMinutes: 60,
        bufferMinutes: 0,
      },
      workingHours: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, // Thứ 2: 4 tiếng (240 phút)
      ],
      busyIntervals: [],
      lockedSessions: [
        {
          id: 'locked-1',
          taskId: 'T1',
          start: '2026-10-19T08:00:00.000Z',
          end: '2026-10-19T09:00:00.000Z', // 60 phút đã khóa
        },
      ],
      tasks: [
        {
          id: 'T1',
          title: 'Task 1',
          estimatedMinutes: 120,
          remainingMinutes: 120, // 60 phút đã khóa + 60 phút cần xếp tiếp
          deadline: '2026-10-19T12:00:00.000Z',
          priority: 'URGENT',
          status: 'TODO',
          dependencyIds: [],
          createdAt: '2026-10-18T00:00:00Z',
        },
        {
          id: 'T2',
          title: 'Task 2',
          estimatedMinutes: 60,
          remainingMinutes: 60,
          deadline: '2026-10-19T12:00:00.000Z',
          priority: 'HIGH',
          status: 'TODO',
          dependencyIds: ['T1'], // T2 phải chờ T1 xong mới được bắt đầu
          createdAt: '2026-10-18T00:00:00Z',
        },
      ],
    };

    const result = schedule(input);

    expect(result.unscheduledTasks).toHaveLength(0);
    expect(result.plannedSessions).toHaveLength(3); // 1 session khóa + 2 session mới

    // Kiểm tra phiên khóa được bảo toàn
    const locked = result.plannedSessions.find(s => s.locked);
    expect(locked).toBeDefined();
    expect(locked?.id).toBe('locked-1');

    // Kiểm tra T2 bắt đầu SAU KHI T1 hoàn tất
    const t1Sessions = result.plannedSessions.filter(s => s.taskId === 'T1');
    const t2Sessions = result.plannedSessions.filter(s => s.taskId === 'T2');

    const t1MaxEnd = Math.max(...t1Sessions.map(s => new Date(s.end).getTime()));
    const t2MinStart = Math.min(...t2Sessions.map(s => new Date(s.start).getTime()));

    expect(t2MinStart).toBeGreaterThanOrEqual(t1MaxEnd);
  });

  it('phải xử lý lập lịch một phần và cảnh báo PARTIALLY_SCHEDULED khi không đủ slot rảnh', () => {
    const input: ScheduleInput = {
      now: '2026-10-19T07:00:00.000Z',
      settings: {
        planningHorizonDays: 1,
        minSessionMinutes: 30,
        maxSessionMinutes: 60,
        bufferMinutes: 0,
      },
      workingHours: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }, // Chỉ có 60 phút rảnh
      ],
      busyIntervals: [],
      lockedSessions: [],
      tasks: [
        {
          id: 'BIG-TASK',
          title: 'Big Task',
          estimatedMinutes: 180,
          remainingMinutes: 180, // Cần 180 phút nhưng chỉ có 60 phút
          deadline: '2026-10-19T12:00:00.000Z',
          priority: 'MEDIUM',
          status: 'TODO',
          dependencyIds: [],
          createdAt: '2026-10-18T00:00:00Z',
        },
      ],
    };

    const result = schedule(input);

    expect(result.plannedSessions).toHaveLength(1);
    expect(result.plannedSessions[0].durationMinutes).toBe(60);

    expect(result.unscheduledTasks).toHaveLength(1);
    expect(result.unscheduledTasks[0].taskId).toBe('BIG-TASK');
    expect(result.unscheduledTasks[0].missingMinutes).toBe(120);

    const warn = result.warnings.find(w => w.code === 'PARTIALLY_SCHEDULED');
    expect(warn).toBeDefined();
  });
});
