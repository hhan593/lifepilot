# LifePilot · 个人生活驾驶舱

天气 + 待办 + 喝水打卡 + 习惯养成 + 自动周报，一个入口全搞定。

- 后端：NestJS 11 + Prisma + PostgreSQL 17 + Redis 8（BullMQ 定时提醒）
- 前端：Next.js 15 (App Router) + Tailwind CSS v4 + TanStack Query，可安装 PWA
- 天气：[Open-Meteo](https://open-meteo.com)（免费、无 key；Provider 适配层可热切和风天气）

## 快速开始

环境要求：Node ≥ 20、pnpm ≥ 9、PostgreSQL、Redis（本机可用 `brew services start postgresql@17 redis`，或用根目录 `docker-compose.yml` 起 postgres + redis）。

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
#   修改 DATABASE_URL / JWT_SECRET（openssl rand -hex 32）
#   生成 Web Push 密钥：pnpm --filter @lifepilot/api generate:vapid

# 3. 建表 + 演示数据
pnpm db:migrate
pnpm db:seed

# 4. 启动（api:4000 + web:3000）
pnpm dev
```

打开 http://localhost:3000 ，演示账号 `demo@lifepilot.app / Demo1234!`，API 文档在 http://localhost:4000/docs 。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动 api（watch）与 web |
| `pnpm build` / `pnpm test` | 构建 / 单元测试 |
| `pnpm test:e2e` | API 全链路 e2e（需本地 pg + redis） |
| `pnpm db:migrate` / `pnpm db:seed` | 迁移 / 演示数据 |

## 架构速览

```
apps/api     NestJS 模块化单体
  modules/   auth users todos water habits cities weather reports notifications scheduler health
  prisma/    schema + migrations + seed
apps/web     Next.js App Router（/app 为登录后主界面，移动优先 + 底部导航）
packages/shared  前后端共享类型、WMO 天气码表、饮水目标公式、饮品折算系数
```

关键设计：

- **认证**：短效 JWT（Authorization 头）+ httpOnly Cookie 刷新令牌旋转（数据库存哈希，可吊销）
- **宽容连击**：习惯按「每周目标次数」计连击周数，漏一天不清零（`apps/api/src/modules/habits/streaks.ts`，纯函数有单测）
- **提醒调度**：BullMQ 每分钟扫描用户提醒时间点 → 免打扰/达标检查 → Web Push（重试 + 指数退避）
- **周报**：按用户时区 ISO 周聚合待办/饮水/习惯 → 结构化 JSON + Markdown，周五定时生成或手动触发
- **天气缓存**：Postgres 10 分钟 TTL，源站故障自动降级过期缓存；Provider 抽象类便于扩展新数据源
- **错误契约**：全局 RFC 7807 problem+json；前端 api client 401 自动刷新重试

## 部署

根目录 `docker-compose.yml` 提供 postgres + redis + api + web 四个服务，`JWT_SECRET` 由环境注入，Caddy 可再加一层 HTTPS 反代。

## 浏览器推送（Web Push）

1. `.env` 中配置 `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`（`pnpm --filter @lifepilot/api generate:vapid`）
2. 前端「设置 → 浏览器推送」一键订阅（iOS 需先添加到主屏幕）
3. `POST /api/v1/notifications/test` 可发一条测试推送
