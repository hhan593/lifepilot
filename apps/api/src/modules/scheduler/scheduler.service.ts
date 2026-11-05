import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isWithinQuietHours, localNow } from '../../common/utils/tz';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportsService } from '../reports/reports.service';
import { WaterService } from '../water/water.service';
import { WaterReminderDedupe } from './water-reminder-dedupe';

const WATER_TIPS = [
  '小口慢饮，补水更均匀 💧',
  '饭前一杯水，有助消化 🍚',
  '咖啡虽好，也要记得喝水哦 ☕',
  '起身接杯水，顺便活动一下 🚶',
  '天冷了也别忘了喝水，温水更舒服 🌡️',
];

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly waterService: WaterService,
    private readonly reportsService: ReportsService,
    private readonly waterDedupe: WaterReminderDedupe,
  ) {}

  /** 每分钟扫描：命中用户配置的提醒时间点 → 检查免打扰/达标 → 投递推送 */
  @Cron('* * * * *')
  async waterReminderSweep() {
    const users = await this.prisma.user.findMany({
      where: { settings: { waterReminderEnabled: true } },
      include: { settings: true },
    });

    for (const user of users) {
      const settings = user.settings;
      if (!settings || settings.waterReminderTimes.length === 0) continue;

      const now = localNow(user.timezone);
      const hhmm = now.toFormat('HH:mm');
      const dateKey = now.toFormat('yyyy-MM-dd');

      if (!settings.waterReminderTimes.includes(hhmm)) continue;

      if (isWithinQuietHours(hhmm, settings.quietStart, settings.quietEnd)) continue;

      // 已达标就不再打扰（提醒要附带价值，而非纯打扰）
      const summary = await this.waterService.summary(user.id, dateKey);
      if (summary.hydrationMl >= summary.goalMl) continue;

      // Redis 原子占位，多实例 / 重启后同一时刻仍只推一次；放在检查之后避免无效占键
      if (!(await this.waterDedupe.claim(user.id, dateKey, hhmm))) continue;

      const body = `${summary.hydrationMl}/${summary.goalMl}ml，还差 ${summary.remainingMl}ml。${WATER_TIPS[Math.floor(Math.random() * WATER_TIPS.length)]}`;
      await this.notifications
        .enqueue(user.id, { kind: 'water', title: '该喝水啦 💧', body, url: '/app' })
        .catch((err: unknown) =>
          this.logger.warn(`投递喝水提醒失败: ${err instanceof Error ? err.message : err}`),
        );
    }
  }

  /** 每小时第 5 分钟扫描：命中用户配置的「周几 + 小时」→ 首次生成周报并推送 */
  @Cron('5 * * * *')
  async weeklyReportSweep() {
    const users = await this.prisma.user.findMany({ include: { settings: true } });

    for (const user of users) {
      const settings = user.settings;
      if (!settings) continue;

      const now = localNow(user.timezone);
      if (now.weekday !== settings.weeklyReportDay) continue;
      if (now.hour !== settings.weeklyReportHour) continue;

      const weekStart = now.startOf('week').toISODate() ?? '';
      const exists = await this.prisma.weeklyReport.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
        select: { id: true },
      });
      if (exists) continue;

      const payload = await this.reportsService.generate(user.id, weekStart);
      await this.notifications
        .enqueue(user.id, {
          kind: 'weekly',
          title: '本周周报已生成 📋',
          body: payload.highlights[0] ?? '点击查看本周回顾',
          url: '/app/reports',
        })
        .catch((err: unknown) =>
          this.logger.warn(`投递周报通知失败: ${err instanceof Error ? err.message : err}`),
        );
    }
  }
}
