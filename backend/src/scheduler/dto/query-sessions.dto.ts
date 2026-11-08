import { IsOptional } from 'class-validator';
import { IsIsoDateTimeWithZone } from '../../common/validators';

export class QuerySessionsDto {
  @IsOptional()
  @IsIsoDateTimeWithZone()
  from?: string;

  @IsOptional()
  @IsIsoDateTimeWithZone()
  to?: string;
}
