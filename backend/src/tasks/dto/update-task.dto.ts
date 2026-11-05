import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

/**
 * Mọi trường đều tuỳ chọn. Không cho sửa estimatedMinutes vì schema quy định
 * đó là "ước tính ban đầu, không đổi"; muốn đổi khối lượng thì sửa remainingMinutes.
 * dependencyIds nếu gửi lên sẽ THAY THẾ toàn bộ danh sách cũ ([] = xoá hết).
 */
export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['estimatedMinutes'] as const)) {}
