/**
 * NestJS Module for Scheduling Engine
 */
import { SchedulingService } from './scheduling.service.js';

export class SchedulingModule {
  static forRoot() {
    return {
      module: SchedulingModule,
      providers: [SchedulingService],
      exports: [SchedulingService],
    };
  }
}

export { SchedulingService };
