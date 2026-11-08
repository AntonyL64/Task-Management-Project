import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { QuerySessionsDto } from './dto/query-sessions.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { toView } from './scheduler.service';

/**
 * Phiên làm việc cho Calendar (Thành viên C):
 * GET để tải lại lịch sau khi lập lịch / đổi tab, PATCH để khoá hoặc mở khoá một phiên.
 */
@Controller('work-sessions')
export class WorkSessionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query() q: QuerySessionsDto) {
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    if (from && to && from >= to) throw new BadRequestException('from phải trước to');

    const where: Prisma.WorkSessionWhereInput = {
      userId: user.id,
      ...(to && { startAt: { lt: to } }),
      ...(from && { endAt: { gt: from } }),
    };
    const sessions = await this.prisma.workSession.findMany({
      where,
      include: { task: { select: { title: true } } },
      orderBy: { startAt: 'asc' },
    });
    return sessions.map((s) => ({ ...toView(s), taskTitle: s.task.title, status: s.status }));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    const session = await this.prisma.workSession.findFirst({ where: { id, userId: user.id } });
    if (!session) throw new NotFoundException('Không tìm thấy phiên');
    if (session.status !== SessionStatus.PLANNED) {
      throw new BadRequestException('Chỉ khoá/mở khoá được phiên chưa diễn ra (PLANNED)');
    }
    const updated = await this.prisma.workSession.update({
      where: { id },
      data: { isLocked: dto.isLocked },
      include: { task: { select: { title: true } } },
    });
    return { ...toView(updated), taskTitle: updated.task.title, status: updated.status };
  }
}
