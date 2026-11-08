import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AutoScheduleDto } from './dto/auto-schedule.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { SchedulerService } from './scheduler.service';

/** Được JwtAuthGuard toàn cục (APP_GUARD) bảo vệ sẵn, không cần @UseGuards. */
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Post('auto-schedule')
  @HttpCode(HttpStatus.OK)
  autoSchedule(@CurrentUser() user: AuthUser, @Body() dto: AutoScheduleDto) {
    return this.scheduler.autoSchedule(user.id, dto);
  }

  @Post('reschedule')
  @HttpCode(HttpStatus.OK)
  reschedule(@CurrentUser() user: AuthUser, @Body() dto: RescheduleDto) {
    return this.scheduler.reschedule(user.id, dto);
  }
}
