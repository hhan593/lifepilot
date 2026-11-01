import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { WaterModule } from '../water/water.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [NotificationsModule, ReportsModule, WaterModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
