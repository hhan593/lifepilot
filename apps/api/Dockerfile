# LifePilot API 生产镜像（构建上下文 = 仓库根目录：docker compose 或 docker build -f apps/api/Dockerfile .）
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --offline

FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @lifepilot/shared build \
 && pnpm --filter @lifepilot/api exec prisma generate --schema prisma/schema.prisma \
 && pnpm --filter @lifepilot/api build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared ./packages/shared

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 4000
# api 先迁移再启动（启动即崩的问题由强校验挡在前面，见 env.ts）
CMD ["sh", "-c", "apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
ENTRYPOINT ["/sbin/tini", "--"]
