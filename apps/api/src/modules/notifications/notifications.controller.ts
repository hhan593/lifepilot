import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

class SubscribeDto {
  @IsString()
  endpoint!: string;

  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

class UnsubscribeDto {
  @IsString()
  endpoint!: string;
}

class ExpoTokenDto {
  @IsString()
  token!: string;
}

@ApiBearerAuth()
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** 前端订阅 Web Push 前先取 VAPID 公钥 */
  @Get('public-key')
  publicKey() {
    return { publicKey: this.notificationsService.getPublicKey() };
  }

  @Post('subscriptions')
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.notificationsService.upsertSubscription(user.id, {
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent,
    });
  }

  @Post('subscriptions/unsubscribe')
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    // 退订必须限定自己的订阅：凭 endpoint 删他人订阅会让别人收不到提醒（IDOR）
    return this.notificationsService.removeSubscription(user.id, dto.endpoint);
  }

  /** 原生 App（Expo）登录后注册远程推送令牌 */
  @Post('expo-token')
  registerExpoToken(@CurrentUser() user: AuthUser, @Body() dto: ExpoTokenDto) {
    return this.notificationsService.upsertExpoToken(user.id, dto.token);
  }

  @Post('expo-token/remove')
  removeExpoToken(@CurrentUser() user: AuthUser, @Body() dto: ExpoTokenDto) {
    return this.notificationsService.removeExpoToken(user.id, dto.token);
  }

  /** 测试推送：验证订阅链路是否打通 */
  @Post('test')
  async test(@CurrentUser() user: AuthUser) {
    await this.notificationsService.enqueue(user.id, {
      kind: 'todo',
      title: 'LifePilot 推送测试 ✅',
      body: '恭喜，通知链路已经打通！',
      url: '/app',
    });
    return { ok: true };
  }
}
