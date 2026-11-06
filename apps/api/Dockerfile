# LifePilot API 生产镜像（构建上下文 = 仓库根目录：docker compose 或 docker build -f apps/api/Dockerfile .）
# BASE_IMAGE 可指向可达的镜像源（受限网络用国内镜像），跨架构构建时配合 --platform
ARG BASE_IMAGE=node:22-alpine
ARG PNPM_REGISTRY=https://registry.npmjs.org
FROM ${BASE_IMAGE} AS deps
ARG PNPM_REGISTRY
ENV npm_config_registry=${PNPM_REGISTRY}
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
# 拷完整 shared：pnpm install 会跑 workspace 包的 prepare（tsc -p tsconfig.json）
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile --registry=${PNPM_REGISTRY}

FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
# 宿主机的增量编译状态会让 tsc 只 emit 与记录有差异的文件（dist 缺 main.js），构建前必须清掉
RUN find /app -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
RUN pnpm --filter @lifepilot/shared build \
 && pnpm --filter @lifepilot/api exec prisma generate --schema prisma/schema.prisma \
 && pnpm --filter @lifepilot/api build

FROM ${BASE_IMAGE} AS runtime
# 受限网络下 dl-cdn.alpinelinux.org 常 DNS 失败，换成阿里云 Alpine 镜像
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared ./packages/shared

# workspace 符号链接（node_modules/@lifepilot/shared → packages/shared）
# 在跨 stage COPY 后失效，替换为实体目录保证 require 可解析
RUN rm -rf /app/node_modules/@lifepilot/shared \
 && mkdir -p /app/node_modules/@lifepilot \
 && cp -rL /app/packages/shared /app/node_modules/@lifepilot/shared

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 4000
# api 先迁移再启动（启动即崩的问题由强校验挡在前面，见 env.ts）
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
ENTRYPOINT ["/sbin/tini", "--"]
