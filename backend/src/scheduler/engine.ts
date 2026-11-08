/**
 * Cầu nối tới Scheduling Engine của Thành viên B (packages/scheduling-engine).
 * Import thẳng mã nguồn để backend luôn dùng đúng phiên bản engine trong repo,
 * không phải chép code. Mọi chỗ khác trong backend chỉ import từ file này.
 */
export {
  schedule,
  InvalidScheduleInputError,
} from '../../../packages/scheduling-engine/src/scheduler';
export type {
  BusyInterval,
  PlannedSession,
  ScheduleInput,
  ScheduleResult,
} from '../../../packages/scheduling-engine/src/scheduler';
export { reschedule } from '../../../packages/scheduling-engine/src/core/rescheduling';
export type { AdvancedRescheduleResult } from '../../../packages/scheduling-engine/src/core/rescheduling';
export {
  buildScheduleInputFromPrisma,
  type PrismaUserWithScheduleContext,
} from '../../../packages/scheduling-engine/src/adapter/prisma-to-contract-adapter';
