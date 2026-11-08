import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RunTrigger, SessionStatus, WorkSession } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { lockUserRow } from '../tasks/tasks.service';
import { AutoScheduleDto } from './dto/auto-schedule.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import {
  BusyInterval,
  InvalidScheduleInputError,
  PlannedSession,
  ScheduleInput,
  ScheduleResult,
  buildScheduleInputFromPrisma,
  reschedule,
  schedule,
} from './engine';
import { expandEvents, tzOffsetMinutes } from './recurrence';

type Tx = Prisma.TransactionClient;

const CONTRACT_VERSION = 2;
/** Làm tròn "bây giờ" lên mốc 5 phút để phiên bắt đầu ở giờ chẵn (10:05 thay vì 10:03:27). */
const ROUND_NOW_MS = 5 * 60_000;
const TX_OPTIONS = { timeout: 20_000 };

/** Phiên trả về cho client: id là id thật trong bảng work_sessions. */
export interface SessionView {
  id: string;
  taskId: string;
  start: string;
  end: string;
  durationMinutes: number;
  locked: boolean;
}

export interface SchedulerResponse extends ScheduleResult {
  runId: string;
  runtimeMs: number;
  plannedSessions: SessionView[];
}

export interface RescheduleResponse extends SchedulerResponse {
  summary: { retained: number; moved: number; cancelled: number; added: number };
}

interface Context {
  now: Date;
  userTz: string;
  input: ScheduleInput;
  /** Phiên PLANNED chưa kết thúc, trước khi chạy. */
  existing: WorkSession[];
}

@Injectable()
export class SchedulerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lập lịch lại toàn bộ: thay mọi phiên chưa khoá trong tương lai bằng kế hoạch mới. */
  autoSchedule(userId: string, dto: AutoScheduleDto): Promise<SchedulerResponse> {
    return this.prisma.$transaction(async (tx) => {
      // Mỗi user chỉ một lần lập lịch tại một thời điểm (tránh hai lần chạy ghi chồng phiên).
      await lockUserRow(tx, userId);
      const ctx = await this.loadContext(tx, userId, dto);

      const { result, runtimeMs } = runEngine(() => schedule(ctx.input));

      await tx.workSession.deleteMany({
        where: { id: { in: ctx.existing.filter((s) => !s.isLocked).map((s) => s.id) } },
      });
      const run = await this.saveRun(tx, userId, RunTrigger.MANUAL, ctx, result, runtimeMs);
      const sessions = await this.insertNewSessions(tx, userId, run.id, result.plannedSessions);
      return { runId: run.id, runtimeMs, ...result, plannedSessions: sessions };
    }, TX_OPTIONS);
  }

  /** Tái lập lịch tối thiểu xáo trộn: chỉ dời phiên bị ảnh hưởng. */
  reschedule(userId: string, dto: RescheduleDto): Promise<RescheduleResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      const ctx = await this.loadContext(tx, userId, {});

      let newBusyEvent: BusyInterval | undefined;
      if (dto.newBusyEventId) {
        const event = await tx.calendarEvent.findFirst({ where: { id: dto.newBusyEventId, userId } });
        if (!event) throw new NotFoundException('Không tìm thấy sự kiện');
        if (event.recurrenceRule) {
          throw new BadRequestException('Sự kiện lặp ảnh hưởng nhiều tuần: hãy dùng /api/scheduler/auto-schedule');
        }
        // Sự kiện đã nằm trong busyIntervals (đọc từ DB); tách ra để engine biết nó là "mới".
        newBusyEvent = ctx.input.busyIntervals.find((b) => b.id === event.id);
        ctx.input.busyIntervals = ctx.input.busyIntervals.filter((b) => b.id !== event.id);
      }
      if (dto.completedTaskId) {
        const owned = await tx.task.count({ where: { id: dto.completedTaskId, userId } });
        if (!owned) throw new NotFoundException('Không tìm thấy task');
      }

      const { result, runtimeMs } = runEngine(() =>
        reschedule({
          currentInput: ctx.input,
          existingPlannedSessions: ctx.existing.map(toEngineSession),
          newBusyEvent,
          taskProgressUpdates: dto.completedTaskId
            ? [{ taskId: dto.completedTaskId, actualMinutesSpent: 0, isCompleted: true }]
            : undefined,
          mode: dto.mode ?? 'MINIMAL_DISRUPTION',
        }),
      );

      // Giữ: phiên engine giữ nguyên chỗ, và phiên đã khoá (trừ khi task đã xong).
      const retained = new Set(result.retainedSessions.map((s) => s.id));
      const cancelled = new Set(result.cancelledSessions.map((s) => s.id));
      const toDelete = ctx.existing.filter(
        (s) => cancelled.has(s.id) || (!s.isLocked && !retained.has(s.id)),
      );
      await tx.workSession.deleteMany({ where: { id: { in: toDelete.map((s) => s.id) } } });

      const trigger = dto.newBusyEventId
        ? RunTrigger.EVENT_CHANGED
        : dto.completedTaskId
          ? RunTrigger.TASK_CHANGED
          : RunTrigger.MANUAL;
      const run = await this.saveRun(tx, userId, trigger, ctx, result, runtimeMs);
      // Phiên "locked" trong kết quả là phiên được giữ lại (đã có trong DB); còn lại là phiên mới.
      const created = await this.insertNewSessions(tx, userId, run.id, result.plannedSessions);
      const kept = ctx.existing.filter((s) => !toDelete.includes(s));

      return {
        runId: run.id,
        runtimeMs,
        plannedSessions: [...kept.map(toView), ...created.filter((s) => !s.locked)].sort((a, b) =>
          a.start.localeCompare(b.start),
        ),
        unscheduledTasks: result.unscheduledTasks,
        warnings: result.warnings,
        summary: {
          retained: kept.length,
          moved: result.shiftedSessions.length,
          cancelled: cancelled.size,
          added: result.newSessions.length,
        },
      };
    }, TX_OPTIONS);
  }

  // ---------------------------------------------------------------------------

  private async loadContext(tx: Tx, userId: string, overrides: AutoScheduleDto): Promise<Context> {
    const now = new Date(Math.ceil(Date.now() / ROUND_NOW_MS) * ROUND_NOW_MS);
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        schedulerSetting: true,
        workingHours: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        tasks: { include: { dependencies: { select: { predecessorId: true } } }, orderBy: { createdAt: 'asc' } },
        calendarEvents: true,
        workSessions: {
          where: { status: SessionStatus.PLANNED, endAt: { gt: now } },
          orderBy: { startAt: 'asc' },
        },
      },
    });

    // Adapter của B dựng tasks, settings, workingHours, lockedSessions đúng Contract v2.
    const input = buildScheduleInputFromPrisma(user, now.toISOString());

    input.settings = {
      ...input.settings,
      ...definedOnly(overrides),
      dailyMaxMinutes:
        overrides.dailyMaxMinutes === undefined
          ? input.settings.dailyMaxMinutes
          : (overrides.dailyMaxMinutes ?? undefined),
      timezoneOffsetMinutes: tzOffsetMinutes(user.timezone, now.getTime()),
    };
    if (input.settings.minSessionMinutes > input.settings.maxSessionMinutes) {
      throw new BadRequestException('minSessionMinutes phải nhỏ hơn hoặc bằng maxSessionMinutes');
    }

    // Bung sự kiện lặp bằng hàm của backend (đúng COUNT/UNTIL/INTERVAL và múi giờ).
    const horizonEnd = now.getTime() + input.settings.planningHorizonDays * 86_400_000;
    input.busyIntervals = expandEvents(user.calendarEvents, user.timezone, now.getTime(), horizonEnd);

    return { now, userTz: user.timezone, input, existing: user.workSessions };
  }

  private saveRun(
    tx: Tx,
    userId: string,
    trigger: RunTrigger,
    ctx: Context,
    result: unknown,
    runtimeMs: number,
  ) {
    const { now: _now, ...stable } = ctx.input; // hash không phụ thuộc thời điểm chạy
    return tx.schedulerRun.create({
      data: {
        userId,
        trigger,
        status: 'APPLIED',
        appliedAt: ctx.now,
        contractVersion: CONTRACT_VERSION,
        input: ctx.input as unknown as Prisma.InputJsonValue,
        inputHash: createHash('sha256').update(JSON.stringify(stable)).digest('hex'),
        result: result as Prisma.InputJsonValue,
        runtimeMs,
      },
    });
  }

  /** Lưu các phiên MỚI (locked = false) và trả về cả phiên giữ nguyên với id thật. */
  private async insertNewSessions(
    tx: Tx,
    userId: string,
    runId: string,
    planned: PlannedSession[],
  ): Promise<SessionView[]> {
    const fresh = planned.filter((s) => !s.locked);
    const rows = fresh.map((s) => {
      const startAt = new Date(s.start);
      const endAt = new Date(s.end);
      const plannedMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
      if (!Number.isInteger(plannedMinutes) || plannedMinutes <= 0) {
        throw new Error(`Engine trả về phiên không hợp lệ: ${s.start} – ${s.end}`);
      }
      return { userId, taskId: s.taskId, startAt, endAt, plannedMinutes, schedulerRunId: runId };
    });
    const created = await tx.workSession.createManyAndReturn({ data: rows });

    const locked = planned.filter((s) => s.locked).map((s) => ({ ...s }));
    return [...locked, ...created.map(toView)].sort((a, b) => a.start.localeCompare(b.start));
  }
}

// ----------------------------------------------------------------------------

function runEngine<T>(fn: () => T): { result: T; runtimeMs: number } {
  const t0 = performance.now();
  try {
    const result = fn();
    return { result, runtimeMs: Math.round(performance.now() - t0) };
  } catch (e) {
    if (e instanceof InvalidScheduleInputError) {
      throw new BadRequestException(`Dữ liệu lập lịch không hợp lệ: ${e.message}`);
    }
    throw e;
  }
}

function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}

export function toView(s: WorkSession): SessionView {
  return {
    id: s.id,
    taskId: s.taskId,
    start: s.startAt.toISOString(),
    end: s.endAt.toISOString(),
    durationMinutes: s.plannedMinutes,
    locked: s.isLocked,
  };
}

function toEngineSession(s: WorkSession): PlannedSession {
  return { ...toView(s) };
}
