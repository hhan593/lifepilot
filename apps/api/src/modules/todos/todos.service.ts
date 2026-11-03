import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TodoPriority } from '@prisma/client';
import { todayRange } from '../../common/utils/tz';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTodoDto, UpdateTodoDto } from './dto/todo.dto';

export type TodoView = 'today' | 'upcoming' | 'done';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, view: TodoView) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const { end } = todayRange(timezone);

    if (view === 'done') {
      return this.prisma.todo.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 100,
      });
    }

    if (view === 'upcoming') {
      return this.prisma.todo.findMany({
        where: { userId, completedAt: null, dueAt: { gte: end } },
      take: 200, // 无界列表防护：upcoming 全量返回在长期排期下响应失控
        orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
      });
    }

    // today：今天或更早到期 + 未设日期的任务（GTD 习惯：没有日期的都算「今日」）
    return this.prisma.todo.findMany({
      where: {
        userId,
        completedAt: null,
        OR: [{ dueAt: { lt: end } }, { dueAt: null }],
      },
      orderBy: [
        { priority: 'desc' },
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
  }

  async create(userId: string, dto: CreateTodoDto) {
    // max+1 与写入放同一事务，避免并发创建拿到相同 sortIndex
    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.todo.aggregate({
        where: { userId, completedAt: null },
        _max: { sortIndex: true },
      });
      return tx.todo.create({
        data: {
          userId,
          title: dto.title.trim(),
          notes: dto.notes,
          priority: (dto.priority as TodoPriority) ?? 'MEDIUM',
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          sortIndex: (agg._max.sortIndex ?? 0) + 1,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateTodoDto) {
    await this.assertOwned(userId, id);
    const data: Prisma.TodoUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.priority !== undefined) data.priority = dto.priority as TodoPriority;
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.completed !== undefined) data.completedAt = dto.completed ? new Date() : null;
    try {
      return await this.prisma.todo.update({ where: { id }, data });
    } catch (err) {
      // 属主断言与写入之间可能被并发删除：P2025 转 404，不落 500
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025') {
        throw new NotFoundException('待办不存在');
      }
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.todo.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const todo = await this.prisma.todo.findFirst({ where: { id, userId }, select: { id: true } });
    if (!todo) throw new NotFoundException('待办不存在');
  }
}
