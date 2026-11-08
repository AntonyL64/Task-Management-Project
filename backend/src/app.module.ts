import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CalendarEventsModule } from './calendar-events/calendar-events.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkingHoursModule } from './working-hours/working-hours.module';

function validateEnv(env: Record<string, unknown>) {
  for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!env[key]) throw new Error(`Thiếu biến môi trường ${key} (xem .env.example)`);
  }
  return env;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    TasksModule,
    CalendarEventsModule,
    WorkingHoursModule,
    SchedulerModule,
  ],
  providers: [
    // Bảo vệ mọi route bằng JWT; route mở phải gắn @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
