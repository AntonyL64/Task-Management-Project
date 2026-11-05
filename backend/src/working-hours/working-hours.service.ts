import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkingHours } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReplaceWorkingHoursDto, WorkingHourSlotDto } from './dto/working-hours.dto';

export interface WorkingHourSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface WorkingHoursResponse {
  /** Múi giờ để hiểu startTime/endTime (giờ địa phương). */
  timezone: string;
  workingHours: WorkingHourSlot[];
}

export const toMinute = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const toHHmm = (minute: number): string =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

const toSlot = (w: WorkingHours): WorkingHourSlot => ({
  id: w.id,
  dayOfWeek: w.weekday,
  startTime: toHHmm(w.startMinute),
  endTime: toHHmm(w.endMinute),
});

@Injectable()
export class WorkingHoursService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<WorkingHoursResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, workingHours: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return { timezone: user.timezone, workingHours: user.workingHours.map(toSlot) };
  }

  async replace(userId: string, dto: ReplaceWorkingHoursDto): Promise<WorkingHoursResponse> {
    const rows = dto.workingHours.map((s) => ({
      userId,
      weekday: s.dayOfWeek,
      startMinute: toMinute(s.startTime),
      endMinute: toMinute(s.endTime),
    }));
    assertNoOverlap(dto.workingHours, rows);

    await this.prisma.$transaction([
      this.prisma.workingHours.deleteMany({ where: { userId } }),
      this.prisma.workingHours.createMany({ data: rows }),
    ]);
    return this.get(userId);
  }
}

/** Kiểm tra trước ràng buộc working_hours_range_chk và working_hours_no_overlap. */
function assertNoOverlap(
  input: WorkingHourSlotDto[],
  rows: { weekday: number; startMinute: number; endMinute: number }[],
) {
  rows.forEach((r, i) => {
    if (r.startMinute >= r.endMinute) {
      const s = input[i];
      throw new BadRequestException(`Khung giờ ${s.startTime}–${s.endTime} (ngày ${s.dayOfWeek}): startTime phải trước endTime`);
    }
  });
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.weekday === cur.weekday && cur.startMinute < prev.endMinute) {
      throw new BadRequestException(
        `Ngày ${cur.weekday}: khung ${toHHmm(prev.startMinute)}–${toHHmm(prev.endMinute)} chồng lên ${toHHmm(cur.startMinute)}–${toHHmm(cur.endMinute)}`,
      );
    }
  }
}
