import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

/** Cấu hình chung cho main.ts và e2e test, để test chạy đúng như production. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // bỏ trường lạ
      forbidNonWhitelisted: true, // ...và báo lỗi 400 nếu client gửi trường lạ
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
}
