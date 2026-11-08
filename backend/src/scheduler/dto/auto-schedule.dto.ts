import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

/**
 * Body của POST /api/scheduler/auto-schedule. Mọi trường đều tuỳ chọn:
 * không gửi thì dùng cấu hình đã lưu trong scheduler_settings của người dùng.
 * Giá trị gửi lên chỉ áp dụng cho lần chạy này, không ghi đè cấu hình đã lưu.
 */
export class AutoScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  planningHorizonDays?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  minSessionMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(720)
  maxSessionMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  bufferMinutes?: number;

  /** null = không giới hạn số phút mỗi ngày. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(15)
  @Max(1440)
  dailyMaxMinutes?: number | null;
}
