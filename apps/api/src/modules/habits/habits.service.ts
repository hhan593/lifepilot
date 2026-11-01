import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { todayISO } from '../../common/utils/tz';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHabitDto } from './dto/habit.dto';
import { computeWeeklyStreak, HabitStreak } from './streaks';

export interface HabitWithStatus {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetPerWeek: number;
  todayChecked: boolean;
  today: string;
  streak: HabitStreak;
}

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<HabitWithStatus[]> {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = todayISO(timezone);

    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      orderBy: { createdAt: 'asc' },
      include: { checkIns: { select: { date: true } } },
    });

    return habits.map((h) => {
      const dates = h.checkIns.map((c) => c.date);
      return {
        id: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color,
        targetPerWeek: h.targetPerWeek,
        today,
        todayChecked: dates.includes(today),
        streak: computeWeeklyStreak(dates, h.targetPerWeek, today),
      };
    });
  }

  async create(userId: string, dto: CreateHabitDto) {
    return this.prisma.habit.create({
      data: {
        userId,
        name: dto.name.trim(),
        icon: dto.icon ?? '✅',
        color: dto.color ?? '#6366f1',
        targetPerWeek: dto.targetPerWeek ?? 7,
      },
    });
  }

  /** 打卡 / 取消打卡（幂等切换） */
  async toggleCheckIn(userId: string, habitId: string, date?: string) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const habit = await this.prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!habit) throw new NotFoundException('习惯不存在');
    if (habit.archived) throw new ForbiddenException('习惯已归档');

    const day = date ?? todayISO(timezone);
    const existing = await this.prisma.habitCheckIn.findUnique({
      where: { habitId_date: { habitId: habit.id, date: day } },
    });

    if (existing) {
      await this.prisma.habitCheckIn.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.habitCheckIn.create({ data: { habitId: habit.id, date: day } });
    }

    const dates = (
      await this.prisma.habitCheckIn.findMany({
        where: { habitId: habit.id },
        select: { date: true },
      })
    ).map((c) => c.date);

    return {
      checked: !existing,
      date: day,
      streak: computeWeeklyStreak(dates, habit.targetPerWeek, todayISO(timezone)),
    };
  }

  async history(userId: string, habitId: string, days = 35) {
    const habit = await this.prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!habit) throw new NotFoundException('习惯不存在');
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });

    const rows = await this.prisma.habitCheckIn.findMany({
      where: { habitId },
      select: { date: true },
      orderBy: { date: 'desc' },
      take: days * 2,
    });
    const set = new Set(rows.map((r) => r.date));

    const result: { date: string; checked: boolean }[] = [];
    for (let i = 0; i < days; i++) {
      const d = DateTime.now().setZone(timezone).minus({ days: i }).toFormat('yyyy-MM-dd');
      result.push({ date: d, checked: set.has(d) });
    }
    return result.reverse();
  }

  async remove(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!habit) throw new NotFoundException('习惯不存在');
    await this.prisma.habit.delete({ where: { id: habitId } });
  }
}
