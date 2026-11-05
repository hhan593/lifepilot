import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';

/** 去重用的独立 Redis 连接（由 REDIS_URL 创建，不复用 BullMQ 的 blocking 连接） */
export const WATER_REMINDER_REDIS = 'WATER_REMINDER_REDIS';

const KEY_PREFIX = 'water:reminder:';
/** 键覆盖当天所有提醒时刻，隔天自动过期，无需手动剪枝 */
const KEY_TTL_SECONDS = 86_400;

/**
 * 喝水提醒的跨实例去重。
 *
 * 内存 Set 在多实例部署下各推各的、进程重启后即失忆，且容量触发的 clear()
 * 会抹掉同一分钟内已推送的键。改用 Redis 原子占位：同一用户 / 同一天 /
 * 同一提醒时刻只允许一个实例放行，TTL 到期自动清理。
 */
@Injectable()
export class WaterReminderDedupe implements OnModuleDestroy {
  private readonly logger = new Logger(WaterReminderDedupe.name);

  constructor(@Inject(WATER_REMINDER_REDIS) private readonly redis: Redis) {}

  /** 原子占位成功返回 true；已被其他实例/上一次扫描占过则返回 false */
  async claim(userId: string, dateKey: string, hhmm: string): Promise<boolean> {
    const key = `${KEY_PREFIX}${userId}|${dateKey}|${hhmm}`;
    try {
      const result = await this.redis.set(key, '1', 'EX', KEY_TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch (err) {
      // Redis 不可用时宁可漏推一轮，也不能让所有实例同时放开去重、造成推送风暴
      this.logger.warn(
        `喝水提醒去重失败，本轮跳过: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
