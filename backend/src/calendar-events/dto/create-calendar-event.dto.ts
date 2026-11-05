import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { IsIsoDateTimeWithZone, IsTimeZone } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Kiểm tra hình thức RRULE (RFC 5545), ví dụ FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10. */
export const RRULE_PATTERN = /^FREQ=(SECONDLY|MINUTELY|HOURLY|DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Za-z0-9,+\-:]+)*$/;

export class CreateCalendarEventDto {
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;

  @IsIsoDateTimeWithZone()
  startAt: string;

  @IsIsoDateTimeWithZone()
  endAt: string;

  /** Sự kiện lặp: RRULE không có tiền tố "RRULE:". null = không lặp. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(RRULE_PATTERN, { message: 'recurrenceRule phải có dạng RRULE, ví dụ FREQ=WEEKLY;BYDAY=MO,WE' })
  recurrenceRule?: string | null;

  /** Múi giờ để bung RRULE; null = dùng múi giờ của người dùng. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsTimeZone()
  timezone?: string | null;

  /** Giờ bắt đầu gốc (UTC) của các buổi bị huỷ. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsIsoDateTimeWithZone({ each: true })
  excludedDates?: string[];

  /** Override (dời một buổi): trỏ về sự kiện lặp gốc, đi kèm originalStartAt. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  recurringEventId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIsoDateTimeWithZone()
  originalStartAt?: string | null;
}
