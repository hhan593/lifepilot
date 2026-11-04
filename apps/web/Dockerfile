# LifePilot Web（Next.js）生产镜像（构建上下文 = 仓库根目录）
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS build
# rewrites 的 destination 在 next build 时固化，运行时再改 API_ORIGIN 无效
ARG API_ORIGIN=http://api:4000
ENV API_ORIGIN=$API_ORIGIN
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @lifepilot/shared build && pnpm --filter @lifepilot/web build

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/shared ./packages/shared

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3000
# next start 必须在 .next 所在目录执行，hoisted 依赖从根 node_modules 解析
CMD ["sh", "-c", "cd apps/web && ../../node_modules/.bin/next start -p 3000"]
ENTRYPOINT ["/sbin/tini", "--"]
