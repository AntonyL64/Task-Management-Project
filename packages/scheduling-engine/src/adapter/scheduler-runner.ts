/**
 * Transactional Scheduler Runner
 * Coordinates running the scheduler engine and persisting the result safely into PostgreSQL via Prisma.
 */

import { createHash } from 'node:crypto';
import { schedule } from '../scheduler.js';
import {
  ScheduleInput,
  ScheduleResult,
} from '../contracts/scheduler-contract.js';
import {
  buildScheduleInputFromPrisma,
  PrismaUserWithScheduleContext,
} from './prisma-to-contract-adapter.js';

export function computeInputHash(input: ScheduleInput): string {
  // Hash the input excluding the 'now' timestamp for idempotent runs
  const { now, ...rest } = input;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
}

export interface PersistenceOperations {
  createSchedulerRun(data: {
    userId: string;
    trigger: string;
    status: string;
    contractVersion: number;
    input: any;
    inputHash: string;
    result: any;
    runtimeMs: number;
    appliedAt: Date;
  }): Promise<{ id: string }>;

  replacePlannedSessions(
    userId: string,
    schedulerRunId: string,
    sessionsToInsert: Array<{
      userId: string;
      taskId: string;
      startAt: Date;
      endAt: Date;
      plannedMinutes: number;
      isLocked: boolean;
      status: string;
      schedulerRunId: string;
    }>
  ): Promise<void>;
}

export class SchedulerRunner {
  /**
   * Executes the full pipeline for a user:
   * 1. Adapts Prisma context to ScheduleInput
   * 2. Computes input hash
   * 3. Runs pure Scheduling Engine
   * 4. Persists the run and new planned sessions transactionally
   */
  public async executeForUser(
    context: PrismaUserWithScheduleContext,
    nowIso: string,
    trigger: string,
    persistence?: PersistenceOperations
  ): Promise<{
    runId?: string;
    input: ScheduleInput;
    inputHash: string;
    result: ScheduleResult;
    runtimeMs: number;
  }> {
    // 1. Adapter
    const input = buildScheduleInputFromPrisma(context, nowIso);
    const inputHash = computeInputHash(input);

    // 2. Execution & Benchmarking
    const startTime = performance.now();
    const result = schedule(input);
    const runtimeMs = Math.round(performance.now() - startTime);

    let runId: string | undefined;

    // 3. Optional persistence
    if (persistence) {
      const runRecord = await persistence.createSchedulerRun({
        userId: context.id,
        trigger,
        status: 'APPLIED',
        contractVersion: 2,
        input: input as any,
        inputHash,
        result: result as any,
        runtimeMs,
        appliedAt: new Date(),
      });
      runId = runRecord.id;

      // Filter newly planned sessions (exclude already locked ones)
      const newSessions = result.plannedSessions
        .filter(s => !s.locked)
        .map(s => ({
          userId: context.id,
          taskId: s.taskId,
          startAt: new Date(s.start),
          endAt: new Date(s.end),
          plannedMinutes: s.durationMinutes,
          isLocked: false,
          status: 'PLANNED',
          schedulerRunId: runRecord.id,
        }));

      await persistence.replacePlannedSessions(context.id, runRecord.id, newSessions);
    }

    return {
      runId,
      input,
      inputHash,
      result,
      runtimeMs,
    };
  }
}
