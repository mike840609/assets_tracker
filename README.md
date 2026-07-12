# 💰 Assets Tracker

A modern, self-hostable net worth and investment tracker. Combine bank accounts, brokerages, crypto wallets, and options positions into one dashboard — with multi-currency support, automated daily snapshots, and FIRE projections.

[![CI](https://github.com/mike840609/asset_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/mike840609/asset_tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![Node 24](https://img.shields.io/badge/node-24.x-green)

![Assets Tracker](./public/opengraph-image.png)

## Features

- 🚀 **Real-time prices** — stocks, ETFs, cryptocurrencies, and options via Yahoo Finance with CoinGecko fallback
- 🌍 **Multi-currency, lossless history** — track assets in any currency; everything converts to your base currency, and snapshots store original balances so history stays accurate even if you change base currency later
- 📈 **Analysis & charts** — net-worth trend, assets/liabilities breakdown, monthly cash flow, top movers, and currency exposure
- 🔭 **FIRE projection** — estimated retirement date and portfolio growth curves from your real savings history
- 🔁 **Recurring transactions** — schedule recurring cash flows and contributions; the daily cron materializes due entries automatically (with catch-up)
- 🤖 **Automated daily snapshots** — built-in Vercel Cron integration records your net worth every day
- ⌨️ **Keyboard-first desktop** — command palette (⌘K / Ctrl+K), Vim-style navigation chords, configurable shortcuts
- 📱 **Native mobile feel** — installable PWA with swipe actions, bottom-sheet dialogs, pull-to-refresh, and haptics
- 🌗 **Theming & i18n** — light/dark/system themes, multiple color schemes, English and Traditional Chinese

## Tech Stack

Next.js 16 (App Router, React Server Components) · PostgreSQL + Prisma 7 · NextAuth.js v5 (Google OAuth) · Tailwind CSS 4 + shadcn/ui · Recharts · next-intl · Zod 4 · Sentry (optional, no-op without a DSN)

## Quick Start

Prerequisites: **Node.js 24** (`nvm use`), **Docker** (for the local database), and pnpm via corepack.

```bash
git clone https://github.com/mike840609/asset_tracker.git
cd asset_tracker
corepack enable                   # activates the pinned pnpm version
pnpm install                      # also runs prisma generate

cp .env.example .env              # local defaults work as-is, no edits needed
pnpm db:up                        # local PostgreSQL via Docker
pnpm exec prisma migrate deploy   # apply committed migrations
pnpm dev                          # open http://localhost:3000
```

The `.env.example` defaults are ready for local testing — **no Google account required**: the login page shows a passwordless **Preview Login** button (via `PREVIEW_AUTH_DISABLED=true`) that signs in a local test user. For real Google sign-in, create a [Google OAuth app](https://console.cloud.google.com/apis/credentials) and set real `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` values.

[`.env.example`](./.env.example) is the complete configuration reference. See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for the full development guide (tests, worktrees, CI-mirroring verification steps).

## Deploying

This project is optimized for **Vercel** with native cron support via `vercel.json`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmike840609%2Fasset_tracker&env=DATABASE_URL,AUTH_SECRET,AUTH_GOOGLE_ID,AUTH_GOOGLE_SECRET,CRON_SECRET,NEXT_PUBLIC_APP_URL)

1. Provision a PostgreSQL database (e.g. [Neon](https://neon.tech)) and a Google OAuth app.
2. Set the environment variables in Vercel → Settings → Environment Variables (`NEXT_PUBLIC_APP_URL` must be your deployed public URL; generate secrets with `openssl rand -base64 32`).
3. Deploy. The Vercel build runs `prisma migrate deploy` automatically before `next build`, and the daily snapshot cron (`/api/cron/snapshot`, 21:30 UTC) is registered from `vercel.json` on production deployments.

`GET /api/health` is an unauthenticated liveness/readiness probe (DB reachability + cron/snapshot freshness) that exposes no user data. Cron internals and region pinning are documented in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md); preview-deployment setup is in [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Tests

```bash
pnpm test:unit        # fast, DB-free Vitest suite (services, validators, serializers)
pnpm test:e2e         # Playwright end-to-end suite
```

## Documentation

| Doc                                            | Contents                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)   | Local dev, preview login, tests, verification steps, git worktrees, preview deployments |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Lossless snapshot / currency-normalization design, cron internals                       |
| [docs/DATABASE.md](./docs/DATABASE.md)         | Schema reference                                                                        |
| [docs/VERSIONING.md](./docs/VERSIONING.md)     | Release process and version bump rules                                                  |
| [CONTRIBUTING.md](./CONTRIBUTING.md)           | Contribution workflow and CI policy                                                     |

## Versioning

The app follows [Semantic Versioning](https://semver.org). Version history lives in `src/lib/changelog.ts` (the single source of truth) and is shown in-app on the **`/changelog`** page and the Settings "Version" card. See [docs/VERSIONING.md](./docs/VERSIONING.md) for the release process.

## Self-hosting and data responsibility

Each deployment owner provides and controls its own Google OAuth credentials, PostgreSQL database, deployment, cron secret, and optional Vercel/Sentry integrations.

Assets Tracker is personal-tracking software, not financial, tax, or investment advice. Self-hosters are responsible for their users' data security, privacy disclosures, regulatory compliance, backups, and access controls.

## Contributing and security

Contributions are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md). Please report vulnerabilities privately under the [Security Policy](./SECURITY.md). Community participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](./LICENSE).
