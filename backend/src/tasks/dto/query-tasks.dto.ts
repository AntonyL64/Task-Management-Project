import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** Cho phép ?status=TODO,IN_PROGRESS hoặc ?status=TODO&status=IN_PROGRESS. */
const toList = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : (Array.isArray(value) ? value : String(value).split(',')).map((s) => String(s).trim()).filter(Boolean);

export class QueryTasksDto {
  @IsOptional()
  @Transform(toList)
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  @IsOptional()
  @Transform(toList)
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  /** UUID của dự án, hoặc "none" để lấy task không thuộc dự án nào. */
  @IsOptional()
  @ValidateIf((_, v) => v !== 'none')
  @IsUUID('all', { message: 'projectId phải là UUID hoặc "none"' })
  projectId?: string;
}
