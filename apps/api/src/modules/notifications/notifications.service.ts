import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
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

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
  ) {}

  /** 通过 BullMQ 投递推送任务（带重试与指数退避），由 Worker 分发到所有渠道 */
  async enqueue(userId: string, payload: PushPayload): Promise<void> {
    await this.queue.add('push', { userId, payload });
  }

  /** Web Push（浏览器 PWA）；未配置 VAPID 时静默跳过 */
  async sendWebPushToUser(userId: string, payload: PushPayload): Promise<number> {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) return 0;

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
            this.logger.warn(`Web Push 发送失败: ${err instanceof Error ? err.message : err}`);
          }
        }
      }),
    );
    return sent;
  }

  /** Expo 原生推送（iOS/Android），走 Expo 官方推送服务，无需自管证书 */
  async sendExpoPushToUser(userId: string, payload: PushPayload): Promise<number> {
    const tokens = await this.prisma.expoPushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return 0;

    const messages = tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: { url: payload.url },
      sound: 'default',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Expo 推送响应异常: ${res.status}`);
        return 0;
      }
      const body = (await res.json()) as {
        data?: { status: 'ok' | 'error'; details?: { error?: string } }[];
      };
      let sent = 0;
      await Promise.all(
        (body.data ?? []).map(async (item, i) => {
          if (item.status === 'ok') {
            sent++;
            return;
          }
          // 令牌失效（卸载/换设备）则清理
          if (item.details?.error === 'DeviceNotRegistered') {
            await this.prisma.expoPushToken.delete({ where: { id: tokens[i].id } }).catch(() => undefined);
          } else {
            this.logger.warn(`Expo 推送单条失败: ${item.details?.error ?? 'unknown'}`);
          }
        }),
      );
      return sent;
    } catch (err) {
      this.logger.warn(`Expo 推送请求失败: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
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

  async upsertExpoToken(userId: string, token: string) {
    return this.prisma.expoPushToken.upsert({
      where: { token },
      create: { userId, token },
      update: { userId },
    });
  }

  async removeExpoToken(token: string) {
    await this.prisma.expoPushToken.deleteMany({ where: { token } });
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
    // 同时分发到浏览器与原生两个渠道；任一渠道失败不影响另一个
    await Promise.allSettled([
      this.notificationsService.sendWebPushToUser(userId, payload),
      this.notificationsService.sendExpoPushToUser(userId, payload),
    ]);
  }

  async onModuleDestroy() {
    // Worker 随宿主进程关闭
  }
}
