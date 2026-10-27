import { describe, it, expect } from 'vitest';
import {
  buildScheduleInputFromPrisma,
  minutesToHHmm,
  PrismaUserWithScheduleContext,
} from '../src/adapter/prisma-to-contract-adapter.js';
import { SchedulerRunner } from '../src/adapter/scheduler-runner.js';

describe('Prisma to Contract v2 Adapter & Runner', () => {
  it('phải chuyển đổi chính xác phút trong ngày sang format HH:mm', () => {
    expect(minutesToHHmm(480)).toBe('08:00');
    expect(minutesToHHmm(690)).toBe('11:30');
    expect(minutesToHHmm(810)).toBe('13:30');
    expect(minutesToHHmm(1050)).toBe('17:30');
  });

  it('phải chuyển đổi dữ liệu Prisma của Member A thành ScheduleInput hợp lệ và chạy thành công', async () => {
    // Mock dữ liệu bám sát seed.sql của Thành viên A cho demo@example.com
    const baseMonday = new Date('2026-10-26T00:00:00.000Z'); // Ngày 0 = thứ 2 tuần sau

    const mockPrismaContext: PrismaUserWithScheduleContext = {
      id: 'a0000000-0000-4000-8000-000000000001',
      timezone: 'Asia/Ho_Chi_Minh',
      schedulerSetting: {
        minSessionMinutes: 30,
        maxSessionMinutes: 120,
        bufferMinutes: 10,
        planningHorizonDays: 14,
        dailyMaxMinutes: 360,
      },
      workingHours: [
        { weekday: 1, startMinute: 480, endMinute: 690 },  // T2: 08:00 - 11:30
        { weekday: 1, startMinute: 810, endMinute: 1050 }, // T2: 13:30 - 17:30
        { weekday: 2, startMinute: 480, endMinute: 690 },  // T3
        { weekday: 2, startMinute: 810, endMinute: 1050 },
        { weekday: 3, startMinute: 480, endMinute: 690 },  // T4
        { weekday: 3, startMinute: 810, endMinute: 1050 },
        { weekday: 4, startMinute: 480, endMinute: 690 },  // T5
        { weekday: 4, startMinute: 810, endMinute: 1050 },
        { weekday: 5, startMinute: 480, endMinute: 690 },  // T6
        { weekday: 5, startMinute: 810, endMinute: 1050 },
      ],
      tasks: [
        {
          id: 'task-01',
          title: 'Thiết kế ERD',
          estimatedMinutes: 240,
          remainingMinutes: 0,
          deadline: new Date(baseMonday.getTime() - 12 * 24 * 3600 * 1000),
          earliestStart: null,
          priority: 'HIGH',
          status: 'DONE',
          createdAt: new Date('2026-10-01T00:00:00Z'),
          dependencies: [],
        },
        {
          id: 'task-02',
          title: 'Viết migration và seed',
          estimatedMinutes: 180,
          remainingMinutes: 90,
          deadline: new Date(baseMonday.getTime() + 1 * 24 * 3600 * 1000 + 17 * 3600 * 1000),
          earliestStart: null,
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          createdAt: new Date('2026-10-01T00:01:00Z'),
          dependencies: [{ predecessorId: 'task-01' }],
        },
        {
          id: 'task-03',
          title: 'API Project và Task',
          estimatedMinutes: 480,
          remainingMinutes: 480,
          deadline: new Date(baseMonday.getTime() + 4 * 24 * 3600 * 1000 + 17 * 3600 * 1000),
          earliestStart: null,
          priority: 'HIGH',
          status: 'TODO',
          createdAt: new Date('2026-10-01T00:02:00Z'),
          dependencies: [{ predecessorId: 'task-02' }],
        },
        {
          id: 'task-04',
          title: 'API lịch và giờ làm',
          estimatedMinutes: 360,
          remainingMinutes: 360,
          deadline: new Date(baseMonday.getTime() + 6 * 24 * 3600 * 1000 + 17 * 3600 * 1000),
          earliestStart: null,
          priority: 'MEDIUM',
          status: 'TODO',
          createdAt: new Date('2026-10-01T00:03:00Z'),
          dependencies: [{ predecessorId: 'task-02' }],
        },
        {
          id: 'task-05',
          title: 'Kiểm thử tích hợp',
          estimatedMinutes: 300,
          remainingMinutes: 300,
          deadline: new Date(baseMonday.getTime() + 13 * 24 * 3600 * 1000 + 17 * 3600 * 1000),
          earliestStart: new Date(baseMonday.getTime() + 7 * 24 * 3600 * 1000),
          priority: 'MEDIUM',
          status: 'TODO',
          createdAt: new Date('2026-10-01T00:04:00Z'),
          dependencies: [{ predecessorId: 'task-03' }, { predecessorId: 'task-04' }],
        },
        {
          id: 'task-07',
          title: 'Ôn chương 1–3',
          estimatedMinutes: 240,
          remainingMinutes: 240,
          deadline: new Date(baseMonday.getTime() + 2 * 24 * 3600 * 1000 + 7 * 3600 * 1000),
          earliestStart: null,
          priority: 'URGENT',
          status: 'TODO',
          createdAt: new Date('2026-10-01T00:05:00Z'),
          dependencies: [],
        },
        {
          id: 'task-17',
          title: 'Chuẩn bị slide thuyết trình',
          estimatedMinutes: 600,
          remainingMinutes: 600,
          deadline: new Date(baseMonday.getTime() + 24 * 3600 * 1000), // Deadline 24h tới
          earliestStart: null,
          priority: 'HIGH',
          status: 'TODO',
          createdAt: new Date('2026-10-01T00:06:00Z'),
          dependencies: [],
        },
      ],
      calendarEvents: [
        {
          id: 'event-sync',
          title: 'Họp nhóm đồ án',
          startAt: new Date(baseMonday.getTime() + 3 * 24 * 3600 * 1000 + 15 * 3600 * 1000),
          endAt: new Date(baseMonday.getTime() + 3 * 24 * 3600 * 1000 + 16 * 3600 * 1000),
          recurrenceRule: null,
          excludedDates: [],
          recurringEventId: null,
          originalStartAt: null,
        },
      ],
      workSessions: [
        {
          id: 'locked-session-task-07',
          taskId: 'task-07',
          startAt: new Date(baseMonday.getTime() + 1 * 24 * 3600 * 1000 + 8 * 3600 * 1000), // Thứ Ba 08:00
          endAt: new Date(baseMonday.getTime() + 1 * 24 * 3600 * 1000 + 10 * 3600 * 1000),  // Thứ Ba 10:00 (120 phút)
          status: 'PLANNED',
          isLocked: true,
        },
      ],
    };

    const runner = new SchedulerRunner();
    const { input, inputHash, result, runtimeMs } = await runner.executeForUser(
      mockPrismaContext,
      baseMonday.toISOString(),
      'MANUAL'
    );

    // 1. Kiểm tra hash
    expect(inputHash).toBeDefined();
    expect(runtimeMs).toBeGreaterThanOrEqual(0);

    // 2. Phiên khóa của task-07 phải được bảo toàn
    const lockedSession = result.plannedSessions.find(s => s.id === 'locked-session-task-07');
    expect(lockedSession).toBeDefined();
    expect(lockedSession?.locked).toBe(true);

    // 3. Phụ thuộc hình thoi: task-01 đã DONE -> task-02 được lên lịch trước -> sau đó đến task-03, task-04 -> cuối cùng là task-05
    const task02Sessions = result.plannedSessions.filter(s => s.taskId === 'task-02');
    const task05Sessions = result.plannedSessions.filter(s => s.taskId === 'task-05');

    expect(task02Sessions.length).toBeGreaterThan(0);
    if (task05Sessions.length > 0) {
      const task02MaxEnd = Math.max(...task02Sessions.map(s => new Date(s.end).getTime()));
      const task05MinStart = Math.min(...task05Sessions.map(s => new Date(s.start).getTime()));
      expect(task05MinStart).toBeGreaterThanOrEqual(task02MaxEnd);
    }

    // 4. Task 17 cần 600 phút nhưng chỉ có 24h -> phải cảnh báo
    const warning = result.warnings.find(w => w.taskId === 'task-17');
    expect(warning).toBeDefined();

    console.log(`✅ Adapter & Engine Test Passed: ${result.plannedSessions.length} sessions planned in ${runtimeMs} ms`);
  });
});
