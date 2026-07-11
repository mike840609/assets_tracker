FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

FROM base AS deps

ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/asset_app?sslmode=disable"
ENV PNPM_CONFIG_PACKAGE_IMPORT_METHOD="copy"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN HUSKY=0 pnpm install --frozen-lockfile

FROM deps AS migrate

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS builder

ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ARG NEXT_PUBLIC_SENTRY_DSN=""

ENV NODE_ENV="production"
ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/asset_app?sslmode=disable"
ENV AUTH_SECRET="docker-build-placeholder"
ENV AUTH_GOOGLE_ID="docker-build-placeholder"
ENV AUTH_GOOGLE_SECRET="docker-build-placeholder"
ENV CRON_SECRET="docker-build-placeholder"
ENV NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=deps /app/src/generated ./src/generated

RUN if [ -z "$NEXT_PUBLIC_SENTRY_DSN" ]; then unset NEXT_PUBLIC_SENTRY_DSN; fi; pnpm build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
