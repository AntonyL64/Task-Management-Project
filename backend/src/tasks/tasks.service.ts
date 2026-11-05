import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const withDeps = { dependencies: { select: { predecessorId: true } } } satisfies Prisma.TaskInclude;
type TaskWithDeps = Prisma.TaskGetPayload<{ include: typeof withDeps }>;

/** Dạng trả về cho client. dependencyIds khớp tên trường của Contract v2. */
export type TaskResponse = Omit<TaskWithDeps, 'dependencies'> & { dependencyIds: string[] };

type Tx = Prisma.TransactionClient;

/** undefined = không gửi (giữ nguyên); null = xoá giá trị; chuỗi = ngày mới. */
const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, q: QueryTasksDto): Promise<TaskResponse[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        ...(q.status?.length && { status: { in: q.status } }),
        ...(q.priority?.length && { priority: { in: q.priority } }),
        ...(q.projectId && { projectId: q.projectId === 'none' ? null : q.projectId }),
      },
      include: withDeps,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return tasks.map(toResponse);
  }

  async findOne(userId: string, id: string): Promise<TaskResponse> {
    const task = await this.prisma.task.findFirst({ where: { id, userId }, include: withDeps });
    // 404 cả khi task thuộc người khác: không để lộ id nào đang tồn tại.
    if (!task) throw new NotFoundException('Không tìm thấy task');
    return toResponse(task);
  }

  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponse> {
    const deadline = toDate(dto.deadline);
    const earliestStart = toDate(dto.earliestStart);
    assertWindow(earliestStart, deadline);
    await this.assertProjectOwned(userId, dto.projectId);

    const status = dto.status ?? TaskStatus.TODO;
    const progress = resolveProgress(status, {
      requestedRemaining: dto.remainingMinutes,
      fallbackRemaining: dto.estimatedMinutes,
      currentCompletedAt: null,
    });

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId,
          title: dto.title,
          description: dto.description ?? null,
          projectId: dto.projectId ?? null,
          priority: dto.priority,
          status,
          deadline,
          earliestStart,
          estimatedMinutes: dto.estimatedMinutes,
          sortOrder: dto.sortOrder,
          ...progress,
        },
      });
      if (dto.dependencyIds?.length) {
        // Task mới chưa có ai phụ thuộc vào nó nên không thể tạo vòng lặp.
        await this.replaceDependencies(tx, userId, task.id, dto.dependencyIds);
      }
      return this.loadInTx(tx, task.id);
    });
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    const current = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!current) throw new NotFoundException('Không tìm thấy task');

    const deadline = toDate(dto.deadline);
    const earliestStart = toDate(dto.earliestStart);
    assertWindow(
      earliestStart === undefined ? current.earliestStart : earliestStart,
      deadline === undefined ? current.deadline : deadline,
    );
    if (dto.projectId !== undefined) await this.assertProjectOwned(userId, dto.projectId);

    const status = dto.status ?? current.status;
    const progress = resolveProgress(status, {
      requestedRemaining: dto.remainingMinutes,
      // Mở lại task đã DONE (remaining đang = 0) mà không nói còn bao nhiêu → làm lại từ đầu.
      fallbackRemaining:
        current.status === TaskStatus.DONE ? current.estimatedMinutes : current.remainingMinutes,
      currentCompletedAt: current.completedAt,
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          projectId: dto.projectId,
          priority: dto.priority,
          status,
          deadline,
          earliestStart,
          sortOrder: dto.sortOrder,
          ...progress,
        },
      });
      if (dto.dependencyIds !== undefined) {
        await this.replaceDependencies(tx, userId, id, dto.dependencyIds);
      }
      return this.loadInTx(tx, id);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    // Phiên làm việc, subtask, phụ thuộc bị xoá theo (onDelete: Cascade).
    const { count } = await this.prisma.task.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Không tìm thấy task');
  }

  // ------------------------------------------------------------------------

  private async assertProjectOwned(userId: string, projectId: string | null | undefined) {
    if (!projectId) return;
    const exists = await this.prisma.project.count({ where: { id: projectId, userId } });
    if (!exists) throw new BadRequestException('projectId không tồn tại');
  }

  /** Thay toàn bộ danh sách task tiền nhiệm của taskId. */
  private async replaceDependencies(tx: Tx, userId: string, taskId: string, predecessorIds: string[]) {
    if (predecessorIds.includes(taskId)) {
      throw new BadRequestException('Task không thể phụ thuộc vào chính nó');
    }
    if (predecessorIds.length) {
      const owned = await tx.task.findMany({
        where: { userId, id: { in: predecessorIds } },
        select: { id: true },
      });
      if (owned.length !== predecessorIds.length) {
        const found = new Set(owned.map((t) => t.id));
        const missing = predecessorIds.filter((pid) => !found.has(pid));
        throw new BadRequestException(`dependencyIds không tồn tại: ${missing.join(', ')}`);
      }
      await assertNoCycle(tx, userId, taskId, predecessorIds);
    }

    await tx.taskDependency.deleteMany({ where: { userId, successorId: taskId } });
    if (predecessorIds.length) {
      await tx.taskDependency.createMany({
        data: predecessorIds.map((predecessorId) => ({ userId, predecessorId, successorId: taskId })),
      });
    }
  }

  private async loadInTx(tx: Tx, id: string): Promise<TaskResponse> {
    const task = await tx.task.findUniqueOrThrow({ where: { id }, include: withDeps });
    return toResponse(task);
  }
}

// ---------------------------- hàm thuần ------------------------------------

function toResponse(task: TaskWithDeps): TaskResponse {
  const { dependencies, ...rest } = task;
  return { ...rest, dependencyIds: dependencies.map((d) => d.predecessorId) };
}

function assertWindow(earliestStart: Date | null | undefined, deadline: Date | null | undefined) {
  if (earliestStart && deadline && earliestStart >= deadline) {
    throw new BadRequestException('earliestStart phải trước deadline');
  }
}

/**
 * DoD: status = DONE thì remainingMinutes = 0 (và completedAt được đặt).
 * Rời khỏi DONE thì completedAt = null. Khớp CHECK tasks_completed_* trong DB.
 */
export function resolveProgress(
  status: TaskStatus,
  opts: { requestedRemaining?: number; fallbackRemaining: number; currentCompletedAt: Date | null },
): Pick<Task, 'remainingMinutes' | 'completedAt'> {
  if (status === TaskStatus.DONE) {
    return { remainingMinutes: 0, completedAt: opts.currentCompletedAt ?? new Date() };
  }
  return { remainingMinutes: opts.requestedRemaining ?? opts.fallbackRemaining, completedAt: null };
}

/**
 * Thêm cạnh P → taskId tạo vòng lặp nếu P là "hậu duệ" của taskId,
 * tức là đi từ taskId theo chiều predecessor → successor sẽ gặp P.
 */
async function assertNoCycle(tx: Tx, userId: string, taskId: string, predecessorIds: string[]) {
  const edges = await tx.taskDependency.findMany({
    where: { userId, NOT: { successorId: taskId } }, // cạnh cũ của taskId sắp bị thay
    select: { predecessorId: true, successorId: true },
  });
  const next = new Map<string, string[]>();
  for (const e of edges) {
    const list = next.get(e.predecessorId) ?? [];
    list.push(e.successorId);
    next.set(e.predecessorId, list);
  }

  const targets = new Set(predecessorIds);
  const seen = new Set<string>([taskId]);
  const queue = [taskId];
  while (queue.length) {
    const node = queue.shift()!;
    for (const succ of next.get(node) ?? []) {
      if (targets.has(succ)) {
        throw new BadRequestException(`Phụ thuộc tạo vòng lặp: ${succ} đang chờ task này`);
      }
      if (!seen.has(succ)) {
        seen.add(succ);
        queue.push(succ);
      }
    }
  }
}
