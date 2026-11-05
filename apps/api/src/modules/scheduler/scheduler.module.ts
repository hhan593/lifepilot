import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { WaterModule } from '../water/water.module';
import { SchedulerService } from './scheduler.service';
import { WATER_REMINDER_REDIS, WaterReminderDedupe } from './water-reminder-dedupe';

@Module({
  imports: [NotificationsModule, ReportsModule, WaterModule],
  providers: [
    SchedulerService,
    WaterReminderDedupe,
    {
      provide: WATER_REMINDER_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          // Redis 离线时命令立即失败，由 WaterReminderDedupe 兜底，不让 cron 挂住
          enableOfflineQueue: false,
        });
        const logger = new Logger('WaterReminderRedis');
        redis.on('error', (err: Error) => logger.warn(`Redis 连接异常: ${err.message}`));
        return redis;
      },
    },
  ],
})
export class SchedulerModule {}
