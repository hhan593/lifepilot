import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DrinkType,
  HYDRATION_COEFFICIENT,
  TodoPriority,
  WeeklyReportPayload,
  WeeklyReportSummary,
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
    const [created, completed, open, completedTodos] = await Promise.all([
      this.prisma.todo.count({ where: { userId, createdAt: { gte: start, lt: end } } }),
      this.prisma.todo.count({ where: { userId, completedAt: { gte: start, lt: end } } }),
      this.prisma.todo.count({
        where: { userId, completedAt: null, createdAt: { lt: end } },
      }),
      this.prisma.todo.findMany({
        where: { userId, completedAt: { gte: start, lt: end } },
        select: { id: true, title: true, priority: true, completedAt: true },
        orderBy: [{ priority: 'desc' }, { completedAt: 'desc' }],
      }),
    ]);

    const denominator = completed + open;
    const completionRate = denominator > 0 ? Math.round((completed / denominator) * 100) : 0;

    const dailyCompleted = [0, 0, 0, 0, 0, 0, 0];
    for (const t of completedTodos) {
      if (t.completedAt) {
        const idx = Math.floor(
          DateTime.fromJSDate(t.completedAt).setZone(tz).diff(weekStart, 'days').days,
        );
        if (idx >= 0 && idx < 7) {
          dailyCompleted[idx]++;
        }
      }
    }

    const topCompleted = completedTodos.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority as TodoPriority,
    }));

    // ---- 饮水（按本地日聚合，饮品系数折算）----
    const logs = await this.prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { loggedAt: true, amountMl: true, drinkType: true },
    });

    const dailyMl = Array.from({ length: 7 }, () => 0);
    const drinkMap = new Map<DrinkType, number>();

    for (const log of logs) {
      const idx = Math.floor(
        DateTime.fromJSDate(log.loggedAt).setZone(tz).diff(weekStart, 'days').days,
      );
      const effectiveMl = Math.round(log.amountMl * HYDRATION_COEFFICIENT[log.drinkType]);
      if (idx >= 0 && idx < 7) {
        dailyMl[idx] += effectiveMl;
      }
      const prev = drinkMap.get(log.drinkType as DrinkType) ?? 0;
      drinkMap.set(log.drinkType as DrinkType, prev + effectiveMl);
    }

    const goalMl = user.settings?.waterGoalMl ?? 2000;
    const totalMl = dailyMl.reduce((a, b) => a + b, 0);
    const goalHitDays = dailyMl.filter((ml) => ml >= goalMl).length;
    const avgMlPerDay = Math.round(totalMl / 7);

    let bestDayIndex = 0;
    let maxDayMl = -1;
    dailyMl.forEach((ml, idx) => {
      if (ml > maxDayMl) {
        maxDayMl = ml;
        bestDayIndex = idx;
      }
    });

    const drinkBreakdown = Array.from(drinkMap.entries())
      .map(([type, amountMl]) => ({
        type,
        amountMl,
        percentage: totalMl > 0 ? Math.round((amountMl / totalMl) * 100) : 0,
      }))
      .sort((a, b) => b.amountMl - a.amountMl);

    // ---- 习惯（7日签到矩阵 + 目标完成）----
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

    const weekDates = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }).toISODate() ?? '');

    const habitStats = habits.map((h) => {
      const checkInDates = new Set(h.checkIns.map((c) => c.date));
      const dailyStatus = weekDates.map((d) => checkInDates.has(d));
      const done = h.checkIns.length;
      return {
        id: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color || '#6366f1',
        targetPerWeek: h.targetPerWeek,
        done,
        achieved: done >= h.targetPerWeek,
        dailyStatus,
      };
    });

    // ---- 评分与画像（生活活力指数 Life Cockpit Score 0-100）----
    const todoScore = denominator > 0 ? completionRate : 70;
    const waterScore = Math.min(
      100,
      Math.round((goalHitDays / 7) * 70 + Math.min(30, (avgMlPerDay / goalMl) * 30)),
    );
    const totalHabitTargets = habitStats.reduce((sum, h) => sum + h.targetPerWeek, 0);
    const totalHabitDone = habitStats.reduce((sum, h) => sum + h.done, 0);
    const achievedHabitCount = habitStats.filter((h) => h.achieved).length;
    const habitScore =
      habitStats.length === 0
        ? 75
        : Math.min(
            100,
            Math.round(
              (achievedHabitCount / habitStats.length) * 65 +
                (totalHabitTargets > 0 ? Math.min(35, (totalHabitDone / totalHabitTargets) * 35) : 35),
            ),
          );

    const score = Math.min(
      100,
      Math.max(10, Math.round(todoScore * 0.35 + waterScore * 0.35 + habitScore * 0.3)),
    );

    let grade: 'S' | 'A' | 'B' | 'C' = 'B';
    let title = '稳健前行者';
    let personaSummary = '各维度平稳推进，保持节奏，下周继续积累动能。';

    if (score >= 85) {
      grade = 'S';
      title = '全能生活家';
      personaSummary = '待办执行果断，水分与习惯双达标，身心状态极佳！';
    } else if (score >= 70) {
      grade = 'A';
      title = '自律精进者';
      personaSummary = '核心目标推进有序，生活节奏清晰，表现十分亮眼。';
    } else if (score >= 50) {
      grade = 'B';
      title = '稳健前行者';
      personaSummary = '生活工作稳中有进，稍加调优就能迈上新台阶。';
    } else {
      grade = 'C';
      title = '蓄势调频中';
      personaSummary = '本周节奏偏慢或处于调整期，下周以小目标重启好状态！';
    }

    // ---- 亮点与建议 ----
    const highlights = this.buildHighlights({
      created,
      completed,
      completionRate,
      open,
      avgMlPerDay,
      goalHitDays,
      habitStats,
    });

    const suggestions = this.buildSuggestions({
      completionRate,
      open,
      goalHitDays,
      avgMlPerDay,
      goalMl,
      habitStats,
      dailyCompleted,
    });

    const payload: WeeklyReportPayload = {
      weekStart: weekStart.toISODate() ?? '',
      weekEnd: weekEnd.minus({ days: 1 }).toISODate() ?? '',
      score,
      grade,
      title,
      personaSummary,
      todos: {
        created,
        completed,
        open,
        completionRate,
        dailyCompleted,
        topCompleted,
      },
      water: {
        goalMl,
        avgMlPerDay,
        goalHitDays,
        dailyMl,
        bestDayIndex,
        drinkBreakdown,
      },
      habits: habitStats,
      highlights,
      suggestions,
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

  /** 只读查询：GET 不再隐式触发生成/重算（预取、爬虫、重试都会放大聚合写库），生成统一走 POST /weekly/generate */
  async latest(userId: string, weekStartISO?: string): Promise<WeeklyReportPayload> {
    const report = weekStartISO
      ? await this.prisma.weeklyReport.findUnique({
          where: { userId_weekStart: { userId, weekStart: weekStartISO } },
        })
      : await this.prisma.weeklyReport.findFirst({
          where: { userId },
          orderBy: { weekStart: 'desc' },
        });
    if (!report) {
      throw new NotFoundException('周报尚未生成，请调用 POST /reports/weekly/generate');
    }
    return report.payload as unknown as WeeklyReportPayload;
  }

  async history(userId: string): Promise<WeeklyReportSummary[]> {
    const list = await this.prisma.weeklyReport.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 12,
    });

    return list.map((item) => {
      const p = item.payload as unknown as WeeklyReportPayload;
      return {
        weekStart: item.weekStart,
        weekEnd: p.weekEnd || '',
        score: p.score ?? 75,
        grade: p.grade ?? 'A',
        title: p.title ?? '生活周报',
        completionRate: p.todos?.completionRate ?? 0,
        generatedAt: item.generatedAt.toISOString(),
      };
    });
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
      highlights.push(`待办完成率高达 ${input.completionRate}%，任务收割机 🚀`);
    } else if (input.completed > 0) {
      highlights.push(`完成待办 ${input.completed} 项（完成率 ${input.completionRate}%），攻克重要事项`);
    }
    if (input.goalHitDays >= 5) {
      highlights.push(`饮水达标 ${input.goalHitDays}/7 天，细胞活力充盈 💧`);
    } else if (input.goalHitDays >= 3) {
      highlights.push(`饮水达标 ${input.goalHitDays} 天，日均 ${input.avgMlPerDay}ml，保持水分补给`);
    } else {
      highlights.push(`本周有 ${input.goalHitDays} 天饮水达标，下周记得在工位常备水杯`);
    }
    const achieved = input.habitStats.filter((h) => h.achieved);
    if (achieved.length > 0) {
      highlights.push(`坚持完成 ${achieved.length} 项习惯周目标：${achieved.map((h) => `${h.icon}${h.name}`).join('、')}`);
    }
    return highlights;
  }

  private buildSuggestions(input: {
    completionRate: number;
    open: number;
    goalHitDays: number;
    avgMlPerDay: number;
    goalMl: number;
    habitStats: WeeklyReportPayload['habits'];
    dailyCompleted: number[];
  }): string[] {
    const suggestions: string[] = [];

    // 饮水建议
    if (input.goalHitDays < 4) {
      suggestions.push('💧 补水建议：上午 10:00 与下午 15:00 容易缺水，建议在工作日设置定时喝水提醒');
    } else {
      suggestions.push('💧 补水建议：饮水习惯稳定，建议继续保持早起一杯温水');
    }

    // 待办建议
    if (input.open >= 5) {
      suggestions.push(`🎯 待办建议：当前仍有 ${input.open} 项积压待办，周一晨间建议进行 15 分钟任务梳理和优先级精简`);
    } else if (input.completionRate >= 80) {
      suggestions.push('🎯 待办建议：本周执行力充沛，下周可尝试挑战 1~2 个高价值重点目标');
    } else {
      suggestions.push('🎯 待办建议：尝试在精力充沛的上午处理最重要的高优先级任务（Eat That Frog）');
    }

    // 习惯建议
    const unachieved = input.habitStats.filter((h) => !h.achieved);
    if (unachieved.length > 0) {
      const h = unachieved[0];
      suggestions.push(`🔥 习惯建议：本周「${h.icon}${h.name}」打卡 ${h.done}/${h.targetPerWeek} 次，下周可绑定到固定日程触发点`);
    } else if (input.habitStats.length > 0) {
      suggestions.push('🔥 习惯建议：习惯全员达标！连续连击能带来复利，下周继续保持');
    }

    return suggestions.slice(0, 3);
  }

  private buildMarkdown(p: WeeklyReportPayload): string {
    const lines: string[] = [];
    const [sy, sm, sd] = p.weekStart.split('-');
    const [, em, ed] = p.weekEnd.split('-');
    lines.push(`# 个人生活周报（${sm}.${sd} – ${em}.${ed}）`);
    lines.push(`**周评分**：${p.score} 分 · **${p.grade} 级**（${p.title}）`);
    lines.push(`> ${p.personaSummary}`);
    lines.push('');
    lines.push('## 🎯 待办执行');
    lines.push(`- 新建 ${p.todos.created} 项，完成 ${p.todos.completed} 项，完成率 ${p.todos.completionRate}%`);
    lines.push(`- 当前积压 ${p.todos.open} 项`);
    if (p.todos.topCompleted.length > 0) {
      lines.push('- **重点成就**：');
      for (const t of p.todos.topCompleted) {
        lines.push(`  - [x] ${t.title}`);
      }
    }
    lines.push('');
    lines.push('## 💧 饮水与健康');
    lines.push(`- 日均饮水 ${p.water.avgMlPerDay.toLocaleString()}ml（目标 ${p.water.goalMl.toLocaleString()}ml）`);
    lines.push(`- 达标天数：${p.water.goalHitDays}/7 天`);
    if (p.water.drinkBreakdown.length > 0) {
      const breakdownText = p.water.drinkBreakdown.map((b) => `${b.type}: ${b.percentage}%`).join('，');
      lines.push(`- 饮品分布：${breakdownText}`);
    }
    lines.push('');
    lines.push('## 🔥 习惯养成');
    if (p.habits.length === 0) {
      lines.push('- 本周暂无习惯记录');
    } else {
      for (const h of p.habits) {
        lines.push(`- ${h.icon} ${h.name}：本周 ${h.done}/${h.targetPerWeek} 次${h.achieved ? ' ✅ 达标' : ''}`);
      }
    }
    if (p.highlights.length > 0) {
      lines.push('');
      lines.push('## 🌟 本周高光');
      for (const h of p.highlights) lines.push(`- ${h}`);
    }
    if (p.suggestions.length > 0) {
      lines.push('');
      lines.push('## 💡 下周建议');
      for (const s of p.suggestions) lines.push(`- ${s}`);
    }
    return lines.join('\n');
  }
}
