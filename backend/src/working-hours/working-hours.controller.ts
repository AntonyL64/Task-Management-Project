import { Body, Controller, Get, Put } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ReplaceWorkingHoursDto } from './dto/working-hours.dto';
import { WorkingHoursService } from './working-hours.service';

@Controller('users/working-hours')
export class WorkingHoursController {
  constructor(private readonly workingHours: WorkingHoursService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.workingHours.get(user.id);
  }

  @Put()
  replace(@CurrentUser() user: AuthUser, @Body() dto: ReplaceWorkingHoursDto) {
    return this.workingHours.replace(user.id, dto);
  }
}
