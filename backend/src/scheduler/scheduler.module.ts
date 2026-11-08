import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { WorkSessionsController } from './work-sessions.controller';

@Module({
  controllers: [SchedulerController, WorkSessionsController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
