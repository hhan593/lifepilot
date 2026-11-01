import { Injectable, NotFoundException } from '@nestjs/common';
import { calcWaterGoalMl } from '@lifepilot/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const userSelect = { id: true, email: true, timezone: true, locale: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelect, settings: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const existing = await this.prisma.userSettings.findUnique({ where: { userId } });

    const data = { ...dto };
    // 未显式给目标但给了体重/活动量时，按个性化公式重算
    if (data.waterGoalMl == null && (data.weightKg != null || data.activityLevel != null)) {
      const weight = data.weightKg ?? existing?.weightKg;
      const level = data.activityLevel ?? existing?.activityLevel ?? 'LIGHT';
      if (weight != null) data.waterGoalMl = calcWaterGoalMl(weight, level);
    }

    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async updateTimezone(userId: string, timezone: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { timezone } });
  }
}
