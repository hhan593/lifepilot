import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import webpush from 'web-push';
import { PushPayload } from '@lifepilot/shared';
import { PrismaService } from '../../prisma/prisma.service';

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface NotificationJobData {
  userId: string;
  payload: PushPayload;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
  ) {}

  /** 通过 BullMQ 投递推送任务（带重试与指数退避） */
  async enqueue(userId: string, payload: PushPayload): Promise<void> {
    await this.queue.add('push', { userId, payload });
  }

  async sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      throw new ServiceUnavailableException('未配置 VAPID 密钥，无法发送推送');
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return 0;

    let sent = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            {
              vapidDetails: {
                subject: this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:dev@lifepilot.app',
                publicKey,
                privateKey,
              },
            },
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 订阅已失效（浏览器清理/重新安装），删掉避免堆积
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            throw err;
          }
        }
      }),
    );
    return sent;
  }

  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  async upsertSubscription(
    userId: string,
    input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { userId, ...input },
      update: { userId, p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent },
    });
  }

  async removeSubscription(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost implements OnModuleDestroy {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { userId, payload } = job.data;
    await this.notificationsService.sendPushToUser(userId, payload);
  }

  async onModuleDestroy() {
    // Worker 随宿主进程关闭
  }
}
