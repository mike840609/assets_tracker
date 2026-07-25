FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# `openssl` is required by Prisma's musl schema-engine, `libc6-compat` by the
# prebuilt native modules Next.js pulls in (sharp).
RUN apk add --no-cache ca-certificates openssl libc6-compat \
  && corepack enable
WORKDIR /app

FROM base AS deps

# Cache mounts are scoped per target platform so a cross-platform build never
# reuses another architecture's cached artifacts.
ARG TARGETPLATFORM

ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/asset_app?sslmode=disable"
ENV PNPM_CONFIG_PACKAGE_IMPORT_METHOD="copy"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN --mount=type=cache,id=pnpm-store-$TARGETPLATFORM,target=/pnpm/store \
  HUSKY=0 pnpm install --frozen-lockfile

# The migration runner only needs the Prisma CLI, the schema, and the migration
# SQL — never the application's dependency tree. Installing just `prisma` keeps
# this image ~5x smaller than reusing `deps`.
FROM base AS migrate

ARG TARGETPLATFORM

ENV PNPM_CONFIG_PACKAGE_IMPORT_METHOD="copy"

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 -G nodejs prisma

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store-$TARGETPLATFORM,target=/pnpm/store \
  PRISMA_VERSION="$(awk '/^      prisma:/{getline; getline; sub(/^ *version: /,""); sub(/\(.*/,""); print; exit}' pnpm-lock.yaml)" \
  && test -n "$PRISMA_VERSION" \
  && rm pnpm-lock.yaml \
  && printf '{"name":"assets-tracker-migrate","private":true}\n' > package.json \
  && pnpm add "prisma@$PRISMA_VERSION" \
  # Migrations run via `node`, so no package manager is needed past this point.
  && rm -rf /root/.cache \
    /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx \
    /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  # The Prisma CLI verifies it can write to its engines directory before it will
  # run. Done inside this layer, so it costs no additional image size.
  && chown -R prisma:nodejs /app

COPY --chown=prisma:nodejs prisma.config.ts ./
COPY --chown=prisma:nodejs prisma ./prisma

USER prisma

# Invoked through `node` rather than `pnpm exec` so the container never has to
# reach npm for a corepack download before migrations can run.
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM base AS builder

ARG TARGETPLATFORM
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ARG NEXT_PUBLIC_SENTRY_DSN=""

ENV NODE_ENV="production"
ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/asset_app?sslmode=disable"
ENV AUTH_SECRET="docker-build-placeholder"
ENV AUTH_SELF_HOST_PASSWORD="docker-build-placeholder"
ENV CRON_SECRET="docker-build-placeholder"
ENV NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=deps /app/src/generated ./src/generated

RUN --mount=type=cache,id=next-build-cache-$TARGETPLATFORM,target=/app/.next/cache,sharing=locked \
  if [ -z "$NEXT_PUBLIC_SENTRY_DSN" ]; then unset NEXT_PUBLIC_SENTRY_DSN; fi; pnpm build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# `node server.js` never needs a package manager. Dropping the ones bundled in
# the base image removes their CVEs from scans and leaves no install tooling
# behind for anyone who gets a shell in the container. Image size is unchanged —
# deleted base-image files only become whiteouts.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx \
  /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
