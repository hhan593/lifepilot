import { Injectable, NotFoundException } from '@nestjs/common';
import {
  HYDRATION_COEFFICIENT,
  WeeklyReportPayload,
} from '@lifepilot/shared';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 生成（或重新生成）某一周的周报；不传周起始则用当前周（用户时区，周一起始） */
  async generate(userId: string, weekStartISO?: string): Promise<WeeklyReportPayload> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { settings: true },
    });
    const tz = user.timezone;

    const weekStart = weekStartISO
      ? DateTime.fromFormat(weekStartISO, 'yyyy-MM-dd', { zone: tz }).startOf('day')
      : DateTime.now().setZone(tz).startOf('week');
    const weekEnd = weekStart.plus({ days: 7 });
    const start = weekStart.toJSDate();
    const end = weekEnd.toJSDate();

    // ---- 待办 ----
    const [created, completed, open] = await Promise.all([
      this.prisma.todo.count({ where: { userId, createdAt: { gte: start, lt: end } } }),
      this.prisma.todo.count({ where: { userId, completedAt: { gte: start, lt: end } } }),
      this.prisma.todo.count({
        where: { userId, completedAt: null, createdAt: { lt: end } },
      }),
    ]);
    const denominator = completed + open;
    const completionRate = denominator > 0 ? Math.round((completed / denominator) * 100) : 0;

    // ---- 饮水（按本地日聚合，饮品系数折算）----
    const logs = await this.prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { loggedAt: true, amountMl: true, drinkType: true },
    });
    const dailyMl = Array.from({ length: 7 }, () => 0);
    for (const log of logs) {
      const idx = Math.floor(
        DateTime.fromJSDate(log.loggedAt).setZone(tz).diff(weekStart, 'days').days,
      );
      if (idx >= 0 && idx < 7) {
        dailyMl[idx] += Math.round(log.amountMl * HYDRATION_COEFFICIENT[log.drinkType]);
      }
    }
    const goalMl = user.settings?.waterGoalMl ?? 2000;
    const totalMl = dailyMl.reduce((a, b) => a + b, 0);
    const goalHitDays = dailyMl.filter((ml) => ml >= goalMl).length;
    const avgMlPerDay = Math.round(totalMl / 7);

    // ---- 习惯（宽容连击：本周次数 >= 每周目标 即达成）----
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      include: {
        checkIns: {
          where: { date: { gte: weekStart.toISODate() ?? '', lt: weekEnd.toISODate() ?? '' } },
          select: { date: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const habitStats = habits.map((h) => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      targetPerWeek: h.targetPerWeek,
      done: h.checkIns.length,
      achieved: h.checkIns.length >= h.targetPerWeek,
    }));

    const payload: WeeklyReportPayload = {
      weekStart: weekStart.toISODate() ?? '',
      weekEnd: weekEnd.minus({ days: 1 }).toISODate() ?? '',
      todos: { created, completed, open, completionRate },
      water: { goalMl, avgMlPerDay, goalHitDays, dailyMl },
      habits: habitStats,
      highlights: this.buildHighlights({
        created,
        completed,
        completionRate,
        open,
        avgMlPerDay,
        goalHitDays,
        habitStats,
      }),
      markdown: '',
    };
    payload.markdown = this.buildMarkdown(payload);

    await this.prisma.weeklyReport.upsert({
      where: { userId_weekStart: { userId, weekStart: payload.weekStart } },
      create: {
        userId,
        weekStart: payload.weekStart,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: { payload: payload as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    });

    return payload;
  }

  async latest(userId: string): Promise<WeeklyReportPayload> {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { userId },
      orderBy: { weekStart: 'desc' },
    });
    if (!report) throw new NotFoundException('还没有周报，点击生成试试');
    return report.payload as unknown as WeeklyReportPayload;
  }

  private buildHighlights(input: {
    created: number;
    completed: number;
    completionRate: number;
    open: number;
    avgMlPerDay: number;
    goalHitDays: number;
    habitStats: WeeklyReportPayload['habits'];
  }): string[] {
    const highlights: string[] = [];

    if (input.completed === 0 && input.created === 0 && input.habitStats.length === 0) {
      highlights.push('本周数据还很少，先从添加一条待办、喝一杯水开始吧 ☀️');
      return highlights;
    }
    if (input.completionRate >= 80) {
      highlights.push(`待办完成率 ${input.completionRate}%，效率在线 👏`);
    } else if (input.completed > 0) {
      highlights.push(`完成待办 ${input.completed} 项（完成率 ${input.completionRate}%），还有 ${input.open} 项待处理`);
    }
    if (input.goalHitDays >= 5) {
      highlights.push(`饮水达标 ${input.goalHitDays}/7 天，保持得很好 💧`);
    } else if (input.goalHitDays <= 2) {
      highlights.push(`本周只有 ${input.goalHitDays} 天饮水达标，下周记得多喝水`);
    }
    const achieved = input.habitStats.filter((h) => h.achieved);
    if (achieved.length > 0) {
      highlights.push(`坚持完成 ${achieved.length} 个习惯的周目标：${achieved.map((h) => `${h.icon}${h.name}`).join('、')}`);
    }
    return highlights;
  }

  private buildMarkdown(p: WeeklyReportPayload): string {
    const lines: string[] = [];
    const [sy, sm, sd] = p.weekStart.split('-');
    const [, em, ed] = p.weekEnd.split('-');
    lines.push(`# 周报（${sm}.${sd} – ${em}.${ed}）`);
    lines.push('');
    lines.push('## 待办');
    lines.push(`- 新建 ${p.todos.created} 项，完成 ${p.todos.completed} 项，完成率 ${p.todos.completionRate}%`);
    lines.push(`- 仍开放 ${p.todos.open} 项`);
    lines.push('');
    lines.push('## 饮水');
    lines.push(`- 日均 ${p.water.avgMlPerDay.toLocaleString()}ml（目标 ${p.water.goalMl.toLocaleString()}ml），达标 ${p.water.goalHitDays}/7 天`);
    lines.push('');
    lines.push('## 习惯');
    if (p.habits.length === 0) {
      lines.push('- 本周暂无习惯记录');
    } else {
      for (const h of p.habits) {
        lines.push(`- ${h.icon} ${h.name}：本周 ${h.done}/${h.targetPerWeek} 次${h.achieved ? ' ✅' : ''}`);
      }
    }
    if (p.highlights.length > 0) {
      lines.push('');
      lines.push('## 亮点');
      for (const h of p.highlights) lines.push(`- ${h}`);
    }
    return lines.join('\n');
  }
}
