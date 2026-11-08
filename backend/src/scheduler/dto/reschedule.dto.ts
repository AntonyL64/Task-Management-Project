import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * Body của POST /api/scheduler/reschedule (Minimum Disruption).
 * - newBusyEventId: sự kiện bận vừa được tạo/sửa (POST /api/calendar/events trước).
 *   Chỉ các phiên va chạm với nó bị dời; phiên khác giữ nguyên chỗ.
 * - completedTaskId: task vừa xong. Các phiên tương lai của nó bị huỷ.
 * Không gửi gì = chạy lại, giữ ổn định các phiên đang có.
 */
export class RescheduleDto {
  @IsOptional()
  @IsUUID()
  newBusyEventId?: string;

  @IsOptional()
  @IsUUID()
  completedTaskId?: string;

  @IsOptional()
  @IsIn(['MINIMAL_DISRUPTION', 'FULL_OPTIMIZATION'])
  mode?: 'MINIMAL_DISRUPTION' | 'FULL_OPTIMIZATION';
}
