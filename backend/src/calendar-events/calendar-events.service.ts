import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEvent, EventSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

interface EventShape {
  startAt: Date;
  endAt: Date;
  recurrenceRule: string | null;
  recurringEventId: string | null;
  originalStartAt: Date | null;
}

@Injectable()
export class CalendarEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trả về bản ghi như lưu trong DB (CHƯA bung RRULE).
   * Sự kiện lặp được trả về nếu bản gốc bắt đầu trước `to`, vì các buổi lặp có thể rơi vào khoảng.
   * Việc bung thành busyIntervals cho Scheduler làm ở PrismaToContractAdapter (Thành viên B).
   */
  async findAll(userId: string, q: QueryCalendarEventsDto): Promise<CalendarEvent[]> {
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    if (from && to && from >= to) throw new BadRequestException('from phải trước to');

    let where: Prisma.CalendarEventWhereInput = { userId };
    if (from || to) {
      where = {
        userId,
        OR: [
          { recurrenceRule: null, ...(to && { startAt: { lt: to } }), ...(from && { endAt: { gt: from } }) },
          { recurrenceRule: { not: null }, ...(to && { startAt: { lt: to } }) },
        ],
      };
    }
    return this.prisma.calendarEvent.findMany({ where, orderBy: { startAt: 'asc' } });
  }

  async create(userId: string, dto: CreateCalendarEventDto): Promise<CalendarEvent> {
    const shape: EventShape = {
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      recurrenceRule: dto.recurrenceRule ?? null,
      recurringEventId: dto.recurringEventId ?? null,
      originalStartAt: toDate(dto.originalStartAt) ?? null,
    };
    await this.assertValid(userId, shape, null);

    return this.prisma.calendarEvent.create({
      data: {
        userId,
        title: dto.title,
        ...shape,
        timezone: dto.timezone ?? null,
        excludedDates: (dto.excludedDates ?? []).map((d) => new Date(d)),
        source: EventSource.INTERNAL, // ICS/GOOGLE chỉ do bộ đồng bộ tạo, không nhận từ client
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateCalendarEventDto): Promise<CalendarEvent> {
    const current = await this.prisma.calendarEvent.findFirst({ where: { id, userId } });
    if (!current) throw new NotFoundException('Không tìm thấy sự kiện');

    const shape: EventShape = {
      startAt: toDate(dto.startAt) ?? current.startAt,
      endAt: toDate(dto.endAt) ?? current.endAt,
      recurrenceRule: dto.recurrenceRule !== undefined ? dto.recurrenceRule : current.recurrenceRule,
      recurringEventId: dto.recurringEventId !== undefined ? dto.recurringEventId : current.recurringEventId,
      originalStartAt:
        dto.originalStartAt !== undefined ? toDate(dto.originalStartAt)! : current.originalStartAt,
    };
    await this.assertValid(userId, shape, id);

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        title: dto.title,
        ...shape,
        timezone: dto.timezone,
        excludedDates: dto.excludedDates?.map((d) => new Date(d)),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    // Xoá sự kiện lặp gốc thì các override của nó bị xoá theo (Cascade).
    const { count } = await this.prisma.calendarEvent.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Không tìm thấy sự kiện');
  }

  /** Kiểm tra trước các ràng buộc SQL để trả lỗi 400 rõ nghĩa thay vì lỗi DB. */
  private async assertValid(userId: string, e: EventShape, selfId: string | null) {
    if (e.endAt <= e.startAt) throw new BadRequestException('endAt phải sau startAt');

    const isOverride = e.recurringEventId !== null;
    if (isOverride !== (e.originalStartAt !== null)) {
      throw new BadRequestException('recurringEventId và originalStartAt phải đi cùng nhau');
    }
    if (!isOverride) return;

    if (e.recurrenceRule) throw new BadRequestException('Bản override không được có recurrenceRule');
    if (e.recurringEventId === selfId) throw new BadRequestException('Sự kiện không thể override chính nó');
    const parent = await this.prisma.calendarEvent.count({
      where: { id: e.recurringEventId!, userId, recurrenceRule: { not: null } },
    });
    if (!parent) throw new BadRequestException('recurringEventId phải là sự kiện lặp của bạn');
  }
}
