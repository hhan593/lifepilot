# LifePilot API —— 多阶段构建
# 构建上下文必须是 monorepo 根目录（docker build -f apps/api/Dockerfile .）

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- 依赖安装（利用层缓存）----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- 构建 ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
# prisma generate 只做代码生成，不连库；占位 URL 仅满足 schema 校验
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm --filter @lifepilot/shared build \
  && cd apps/api && ../../node_modules/.bin/prisma generate \
  && pnpm exec nest build

# ---- 运行镜像 ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000
# 启动前自动执行未应用的数据库迁移
CMD ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy && node dist/main.js"]
