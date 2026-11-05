import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

type PrismaError =
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientUnknownRequestError;

/**
 * Đổi lỗi Prisma/PostgreSQL thành HTTP status dễ hiểu, thay vì 500.
 * Phần lớn lỗi đã được service chặn trước; filter này là lưới an toàn cho
 * ràng buộc SQL (CHECK, EXCLUDE, trigger) và race condition.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: PrismaError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.map(exception);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception.message);
    res.status(status).json({ statusCode: status, message, error: HttpStatus[status] });
  }

  private map(e: PrismaError): { status: number; message: string } {
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
    const text = `${e.message} ${JSON.stringify((e as Prisma.PrismaClientKnownRequestError).meta ?? {})}`;

    if (code === 'P2002') return { status: HttpStatus.CONFLICT, message: 'Dữ liệu bị trùng' };
    if (code === 'P2025') return { status: HttpStatus.NOT_FOUND, message: 'Không tìm thấy bản ghi' };
    if (code === 'P2003') return { status: HttpStatus.BAD_REQUEST, message: 'Khoá ngoại không hợp lệ' };
    // 23P01: vi phạm EXCLUDE (trùng giờ). 23514: vi phạm CHECK hoặc trigger cùng chủ sở hữu.
    if (/23P01|exclusion constraint/i.test(text))
      return { status: HttpStatus.CONFLICT, message: 'Khoảng thời gian bị chồng lên dữ liệu đã có' };
    if (/23514|check constraint/i.test(text))
      return { status: HttpStatus.BAD_REQUEST, message: 'Dữ liệu vi phạm ràng buộc của cơ sở dữ liệu' };
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Lỗi cơ sở dữ liệu' };
  }
}
