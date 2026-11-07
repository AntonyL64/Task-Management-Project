import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';

/** "HH:mm" từ 00:00 đến 24:00 (24:00 = hết ngày). */
const HHMM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Đúng dạng workingHours[] trong Contract v2. Giờ là GIỜ ĐỊA PHƯƠNG của người dùng. */
export class WorkingHourSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0 = Chủ nhật … 6 = Thứ bảy

  @Matches(HHMM, { message: 'startTime phải có dạng HH:mm' })
  startTime: string;

  @Matches(HHMM, { message: 'endTime phải có dạng HH:mm' })
  endTime: string;
}

/** PUT thay thế TOÀN BỘ giờ làm của tuần. Gửi [] để xoá hết. */
export class ReplaceWorkingHoursDto {
  @IsArray()
  @ArrayMaxSize(7 * 24)
  @ValidateNested({ each: true })
  @Type(() => WorkingHourSlotDto)
  workingHours: WorkingHourSlotDto[];
}
