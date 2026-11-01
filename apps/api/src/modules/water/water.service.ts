import { Injectable, NotFoundException } from '@nestjs/common';
import { HYDRATION_COEFFICIENT, DrinkType } from '@lifepilot/shared';
import { dayRange, todayISO } from '../../common/utils/tz';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWaterLogDto } from './dto/water.dto';

export interface WaterSummary {
  date: string;
  totalMl: number;
  /** 按饮品系数折算后的补水量 */
  hydrationMl: number;
  goalMl: number;
  percent: number;
  remainingMl: number;
  logCount: number;
}

@Injectable()
export class WaterService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, dto: CreateWaterLogDto) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const log = await this.prisma.waterLog.create({
      data: {
        userId,
        amountMl: dto.amountMl,
        drinkType: (dto.drinkType as DrinkType) ?? 'WATER',
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      },
    });
    return { log, summary: await this.summary(userId, todayISO(timezone)) };
  }

  /** 一键记录一杯（按用户的杯量设置） */
  async quickAdd(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    return this.log(userId, { amountMl: settings?.cupSizeMl ?? 250 });
  }

  async listLogs(userId: string, date?: string) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const day = date ?? todayISO(timezone);
    const { start, end } = dayRange(timezone, day);
    return this.prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: 'asc' },
    });
  }

  async summary(userId: string, date?: string): Promise<WaterSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true, settings: true },
    });
    if (!user.settings) throw new NotFoundException('用户设置缺失');
    const day = date ?? todayISO(user.timezone);
    const { start, end } = dayRange(user.timezone, day);

    const logs = await this.prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { amountMl: true, drinkType: true },
    });

    const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
    const hydrationMl = Math.round(
      logs.reduce((sum, l) => sum + l.amountMl * HYDRATION_COEFFICIENT[l.drinkType], 0),
    );
    const goalMl = user.settings.waterGoalMl;

    return {
      date: day,
      totalMl,
      hydrationMl,
      goalMl,
      percent: goalMl > 0 ? Math.min(100, Math.round((hydrationMl / goalMl) * 100)) : 0,
      remainingMl: Math.max(0, goalMl - hydrationMl),
      logCount: logs.length,
    };
  }
}
