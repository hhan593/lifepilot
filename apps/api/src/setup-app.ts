import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** main.ts 与 e2e 测试共用的应用级配置，避免两边行为不一致 */
export function setupApp(app: INestApplication) {
  // 反向代理拓扑声明（Throttler 按 req.ip 限流，不声明则代理后全站共享一个 IP 配额）：
  // 默认 loopback（nginx/caddy 同机反代，最常见拓扑），可用 TRUST_PROXY 覆盖（如 "1" 或逗号分隔网段）；
  // 直连部署下远程 X-Forwarded-For 仍不可信，无法伪造绕过限流
  const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
  const instance = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  instance.set?.('trust proxy', trustProxy === 'false' ? false : trustProxy);
  // Swagger UI 依赖 CDN 脚本，仅非生产关闭 CSP（生产 API 不挂 Swagger，无需豁免）
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
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
