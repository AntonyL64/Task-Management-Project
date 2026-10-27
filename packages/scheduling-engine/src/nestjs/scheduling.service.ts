/**
 * NestJS Integration Wrapper for Scheduling Engine
 * Can be directly imported into any NestJS application module.
 */

import { schedule } from '../scheduler.js';
import { rescheduleOnCalendarChange, RescheduleRequest } from '../core/rescheduling.js';
import {
  ScheduleInput,
  ScheduleResult,
  InvalidScheduleInputError,
} from '../contracts/scheduler-contract.js';

export class SchedulingService {
  /**
   * Run full deterministic scheduling pipeline
   */
  public generateSchedule(input: ScheduleInput): ScheduleResult {
    return schedule(input);
  }

  /**
   * Run rescheduling when calendar events change or tasks are updated
   */
  public handleReschedule(request: RescheduleRequest): ScheduleResult {
    return rescheduleOnCalendarChange(request);
  }
}

export { InvalidScheduleInputError };
