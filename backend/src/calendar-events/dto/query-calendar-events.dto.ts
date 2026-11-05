import { IsOptional } from 'class-validator';
import { IsIsoDateTimeWithZone } from '../../common/validators';

/** Lọc sự kiện giao với khoảng [from, to). Bỏ trống cả hai = lấy tất cả. */
export class QueryCalendarEventsDto {
  @IsOptional()
  @IsIsoDateTimeWithZone()
  from?: string;

  @IsOptional()
  @IsIsoDateTimeWithZone()
  to?: string;
}
