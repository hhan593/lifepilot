import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationProcessor, NotificationsService, NOTIFICATIONS_QUEUE } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
