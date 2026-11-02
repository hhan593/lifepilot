# LifePilot · 个人生活驾驶舱

天气 + 待办 + 喝水打卡 + 习惯养成 + 自动周报，一个入口全搞定。

- 后端：NestJS 11 + Prisma + PostgreSQL 17 + Redis 8（BullMQ 定时提醒）
- 移动端（主力）：**Expo SDK 58 / React Native 0.88** + NativeWind 5（Tailwind v4）+ TanStack Query，**iOS / Android / H5 三端同源**
- Web 端：Next.js 15 (App Router) + Tailwind CSS v4 + TanStack Query，可安装 PWA（桌面仪表盘）
- 天气：[Open-Meteo](https://open-meteo.com)（免费、无 key；Provider 适配层可热切和风天气）

## 移动端 App（iOS / Android / H5）

```bash
# 开发：iOS 模拟器 / Android 模拟器（需 Xcode 或 Android Studio）
pnpm --filter @lifepilot/mobile ios     # 或 android
# 真机：同一局域网内，把 apps/mobile/.env 的
# EXPO_PUBLIC_API_BASE 改成 http://<Mac局域网IP>:4000/api/v1 后扫码

# H5：开发模式直接访问 http://localhost:8081/login
pnpm --filter @lifepilot/mobile start
# 三端静态产物（CI / 部署校验）：
cd apps/mobile && pnpm exec expo export --platform ios|android|web

# 打包可安装的正式包（需要 Expo 账号）
cd apps/mobile && npx eas build --platform ios
```

## 发包（GitHub 全链路，iOS 除外）

仓库已配 `.github/workflows/release.yml`，**打 tag 即发包**：

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Actions 会自动完成三件事并挂到 [Releases](https://github.com/hhan593/lifepilot/releases)：

1. **Android APK**（自签名 release 包，`android/app/lifepilot-release.keystore` 随私有仓库入库；CI 上若无密钥自动回退 debug 签名——仅供测试，升级安装需同一密钥）
2. **H5 静态包**（`h5-dist.tar.gz`，含 SPA 404 回退）
3. **GitHub Pages 部署**（`https://hhan593.github.io/lifepilot/`，CI 注入 `EXPO_PUBLIC_BASE_URL` 子路径）

本地手动出 APK：

```bash
cd apps/mobile/android && JAVA_HOME=<JDK17+> ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

注意事项：
- **私有仓库 + 免费套餐跑不了 GitHub Pages**（Actions 可以跑，每月 2000 分钟免费额度）；Pages 需把仓库改为 public 或升级 Pro：`gh repo edit --visibility public`
- H5 部署地址记得在 App 的 `.env`/服务端把 API 地址换成公网可达地址
- iOS 正式包必须走 Apple Developer 账号（TestFlight/App Store），GitHub 无法绕过签名

- **三端兼容层**（`src/lib/`）：令牌存储 `storage.ts`（原生 Keychain/Keystore，H5 降级 localStorage）；`notifications.ts` / `haptics.ts` 无 web 入口的包按 `Platform.OS` 懒加载，H5 自动降级
- **CORS**：H5 跑在 8081 端口，需在根 `.env` 的 `WEB_ORIGIN` 里包含 `http://localhost:8081`
- 喝水提醒 = 设备**本地通知**（iOS/Android，离线生效）；H5 提醒由 Web Push 渠道承担
- 周报完成 = 服务端经 Expo Push 推送；令牌登录后自动注册（正式包需在 app.json 配 EAS projectId）
- 图标用系统 emoji（SF Symbols 图标可在引入 `expo-symbols` 后替换；`@expo/vector-icons` 在 Expo Go + RN 0.88 下存在 AssetRegistry 兼容问题）

### monorepo 注意事项（踩坑记录）

- pnpm 11：`nodeLinker: hoisted` 必须写在 `pnpm-workspace.yaml`（.npmrc 已无效）；Expo/Metro 在 pnpm 符号链接布局下无法正常工作
- 全仓锁版本（见 workspace overrides）：`react`/`react-dom` 19.3.1（Expo 模板 19.3.0 与 Next 的 react-dom peer 冲突）、`typescript` 5.9.3（mobile 模板的 TS 6 会判 API 的 tsconfig 为错误）、`@babel/core` 7.29.7、`lightningcss` 1.30.1（1.32 与 react-native-css 有反序列化不兼容）
- NativeWind 5 = `react-native-css`（Metro 层 CSS）+ `@tailwindcss/postcss`（Tailwind v4）；不需要 babel 插件


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

# 4. 启动 api + web
pnpm dev
# 5. 移动端（另开终端）
pnpm --filter @lifepilot/mobile ios
```

打开 http://localhost:3000 或 iOS 模拟器里的 LifePilot，演示账号 `demo@lifepilot.app / Demo1234!`，API 文档在 http://localhost:4000/docs 。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动 api（watch）与 web |
| `pnpm --filter @lifepilot/mobile ios` | Expo 启动 + iOS 模拟器 |
| `pnpm build` / `pnpm test` | 构建 / 单元测试 |
| `pnpm test:e2e` | API 全链路 e2e（需本地 pg + redis） |
| `pnpm db:migrate` / `pnpm db:seed` | 迁移 / 演示数据 |

## 架构速览

```
apps/api     NestJS 模块化单体
  modules/   auth users todos water habits cities weather reports notifications scheduler health
  prisma/    schema + migrations + seed
apps/mobile  Expo / React Native 原生 App（expo-router 文件路由 + 底部 Tab）
apps/web     Next.js App Router（/app 为登录后主界面，桌面仪表盘）
packages/shared  三端共享类型、WMO 天气码表、饮水目标公式、饮品折算系数
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
