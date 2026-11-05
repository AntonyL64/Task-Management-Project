import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsIsoDateTimeWithZone } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Giới hạn trên hợp lý: 1 năm làm việc liên tục, chặn số vô lý từ client. */
const MAX_MINUTES = 525_600;

export class CreateTaskDto {
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  /** null = không thuộc dự án nào. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIsoDateTimeWithZone()
  deadline?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIsoDateTimeWithZone()
  earliestStart?: string | null;

  @IsInt()
  @Min(1)
  @Max(MAX_MINUTES)
  estimatedMinutes: number;

  /** Bỏ trống thì bằng estimatedMinutes. Bị bỏ qua nếu status = DONE (luôn là 0). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINUTES)
  remainingMinutes?: number;

  /** Id các task phải xong trước task này (Finish-to-Start). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  dependencyIds?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
