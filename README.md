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

1. **Android APK**（自签名 release 包。keystore 与签名密码均经 GitHub Secret 注入：`LIFEPILOT_KEYSTORE_BASE64` / `LIFEPILOT_UPLOAD_STORE_PASSWORD` / `LIFEPILOT_UPLOAD_KEY_PASSWORD`，**不入库**；缺任一 Secret 时构建直接失败，不会回退 debug 签名）
2. **H5 静态包**（`h5-dist.tar.gz`，含 SPA 404 回退）
3. **GitHub Pages 部署**（`https://hhan593.github.io/lifepilot/`，CI 注入 `EXPO_PUBLIC_BASE_URL` 子路径）

本地手动出 APK：

```bash
# keystore 放 android/app/lifepilot-release.keystore（已在 .gitignore）；
# 密码写入 android/gradle.properties（同样不入库）：
#   LIFEPILOT_UPLOAD_STORE_PASSWORD=... / LIFEPILOT_UPLOAD_KEY_PASSWORD=...
cd apps/mobile/android && JAVA_HOME=<JDK17+> ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

release 打包前会强制校验 keystore 与两个密码，缺任一即构建失败（不会静默回退 debug 签名）；debug 构建不受影响。

注意事项：
- （仓库现为 public，Pages 已上线；若转回 private，免费套餐 Pages 会停）
- H5 部署地址记得在 App 的 `.env`/服务端把 API 地址换成公网可达地址
- iOS 正式包必须走 Apple Developer 账号（TestFlight/App Store），GitHub 无法绕过签名

## 后端公网部署（让线上 H5 可用）

仓库带 [Render](https://render.com) 一键蓝图（免费 Postgres + 免费 Redis + 免费额度 Web 服务，`render.yaml`）：

1. 打开 **https://dashboard.render.com/blueprint-installer?repo=https://github.com/hhan593/lifepilot** → 用 GitHub 登录 → Apply
   （或 Render 控制台 New → Blueprint → 选本仓库）
2. 构建完成后拿到 API 地址（形如 `https://lifepilot-api-xxxx.onrender.com`），健康检查：`/api/v1/health`
3. GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 添加：
   `PUBLIC_API_BASE_URL = https://lifepilot-api-xxxx.onrender.com/api/v1`
4. 重新发版：`git tag v0.1.1 && git push origin v0.1.1` → Pages 上的 H5 自动指向公网 API
5. （可选）Web Push：Render 环境变量里填入 VAPID 密钥（本地 `pnpm --filter @lifepilot/api generate:vapid` 生成）
6. （可选）导入演示数据：本地 `DATABASE_URL="<Render连接串>" pnpm db:seed`

替代平台：Railway（`railway up`）/ Fly.io / 任意 VPS——API 镜像用根目录 `apps/api/Dockerfile` 构建，任意容器平台可跑。

- **免费额度须知**：Render 免费 Web 服务 15 分钟无流量会休眠（首次唤醒 ~30s）；免费 Postgres 有保留期（当前 30 天），到期控制台续期
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
- **提醒调度**：BullMQ 每分钟扫描用户提醒时间点 → 免打扰/达标检查 → Web Push（重试 + 指数退避）；同一用户/日期/时刻的去重键存 Redis（`SET NX EX 86400`），多实例与重启都不会重复推送
- **周报**：按用户时区 ISO 周聚合待办/饮水/习惯 → 结构化 JSON + Markdown，周五定时生成或手动触发
- **天气缓存**：Postgres 10 分钟 TTL，源站故障自动降级过期缓存；Provider 抽象类便于扩展新数据源
- **错误契约**：全局 RFC 7807 problem+json；前端 api client 401 自动刷新重试

## 部署

根目录 `docker-compose.yml` 提供 postgres + redis + api + web 四个服务。以下是 2 核 2G VPS（Ubuntu 22.04、无域名）的部署记录。

### 拓扑

- 入口 `http://<公网 IP>:3000`（Next `web`），`/api/*` 由 Next rewrites 同源代理到 `api:4000`，无需 Caddy / 域名。
- `postgres`(5432) / `redis`(6379) / `api`(4000) 的端口只绑 `127.0.0.1`，仅 3000 对外；安全组只需放行 3000。
- 四个容器设了 `mem_limit`（合计约 1.5G），服务器另加 4G swap 兜底。
- 构建必须**串行**：并行构建 api + web 时 `next build` 峰值 1G+，2G 机器会 OOM。

### 网络前提（国内 VPS 实测）

`registry-1.docker.io`、`get.docker.com`、`github.com` 均不可达；可用的是 `docker.m.daocloud.io`、`registry.npmmirror.com`、`mirrors.aliyun.com`、`ghcr.io` 和系统自带的 Ubuntu apt 源。因此：

- Docker 走 apt 安装，不用官方安装脚本；
- 代码用 `scp` 传构建上下文，不用 `git clone`；
- 镜像在服务器原生 amd64 构建（Apple Silicon 开发机跨架构 QEMU 跑 `pnpm install` 极慢且易断流）；
- Dockerfile 用 `BASE_IMAGE` / `PNPM_REGISTRY` 两个 build-arg 切镜像源，`apk` 源已改为阿里云。

### 环境变量（服务器 `/opt/lifepilot/.env`，不入库）

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_PASSWORD` | 数据库密码，`openssl rand -hex 24`；同时用于 `DATABASE_URL` |
| `JWT_SECRET` | 至少 16 位，`openssl rand -hex 32`；缺失时 compose 直接报错 |
| `WEB_ORIGIN` | 允许的前端来源，如 `http://36.150.237.4:3000`（多个逗号分隔） |
| `TRUST_PROXY` | `1`：Next rewrites 是一跳代理，让 api 信任 `X-Forwarded-For`，否则限流把所有用户算一个 IP |
| `COOKIE_SECURE` | 纯 HTTP 必须 `false`；上 HTTPS 后改 `true`（不设则按 `NODE_ENV=production` 默认 true） |
| `VAPID_*` | Web Push 可选，不配则静默跳过 |

### 首次部署

```bash
# 1) 服务器：Docker + swap
apt-get install -y docker.io docker-compose-v2 && systemctl enable --now docker
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2) 开发机：打包构建上下文（排除 node_modules / .env / mobile），scp 到服务器解压
tar -czf /tmp/lp_src.tgz --exclude=.git --exclude=node_modules --exclude='*/node_modules' \
  --exclude=.env --exclude='.env.*' --exclude=dist --exclude=.next --exclude=apps/mobile .
scp -i <pem> /tmp/lp_src.tgz root@<ip>:/tmp/
# 服务器
mkdir -p /opt/lifepilot && tar -xzf /tmp/lp_src.tgz -C /opt/lifepilot

# 3) 服务器：生成 .env
printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\nWEB_ORIGIN=http://<ip>:3000\nTRUST_PROXY=1\nCOOKIE_SECURE=false\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > /opt/lifepilot/.env
chmod 600 /opt/lifepilot/.env

# 4) 服务器：串行构建（不要一次 build 两个服务）
cd /opt/lifepilot
ARGS='--build-arg BASE_IMAGE=docker.m.daocloud.io/library/node:22-alpine --build-arg PNPM_REGISTRY=https://registry.npmmirror.com'
docker compose build $ARGS api
docker compose build $ARGS web

# 5) 启动与验证
docker compose up -d --no-build
curl -s http://127.0.0.1:3000/api/v1/health
```

后续更新：重新传源码、`docker compose build` 后再 `up -d --no-build`。数据库密码变更只影响首次初始化的卷，已有卷需另行 `ALTER USER`。

### 其它平台

仓库带 [Render](https://render.com) 一键蓝图（`render.yaml`），见上文「后端公网部署」；Railway / Fly.io 可用 `apps/api/Dockerfile`（构建上下文为仓库根）。

## 浏览器推送（Web Push）

1. `.env` 中配置 `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`（`pnpm --filter @lifepilot/api generate:vapid`）
2. 前端「设置 → 浏览器推送」一键订阅（iOS 需先添加到主屏幕）
3. `POST /api/v1/notifications/test` 可发一条测试推送
