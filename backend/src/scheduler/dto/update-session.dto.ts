import { IsBoolean } from 'class-validator';

/** PATCH /api/work-sessions/:id — khoá/mở khoá một phiên (nút 🔒 trên Calendar). */
export class UpdateSessionDto {
  @IsBoolean()
  isLocked: boolean;
}
