import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** main.ts 与 e2e 测试共用的应用级配置，避免两边行为不一致 */
export function setupApp(app: INestApplication) {
  // Swagger UI 依赖 CDN 脚本，本地开发关闭 CSP
  app.use(helmet({ contentSecurityPolicy: false }));
  // refresh token 走 httpOnly Cookie，必须有 cookie 解析
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
