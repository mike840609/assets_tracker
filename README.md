# 💰 Assets Tracker

[![CI](https://github.com/mike840609/assets_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/mike840609/assets_tracker/actions/workflows/ci.yml)
[![E2E](https://github.com/mike840609/assets_tracker/actions/workflows/e2e.yml/badge.svg?branch=master&event=push)](https://github.com/mike840609/assets_tracker/actions/workflows/e2e.yml?query=branch%3Amaster+event%3Apush)
[![Release](https://img.shields.io/github/v/release/mike840609/assets_tracker)](https://github.com/mike840609/assets_tracker/releases/latest)
[![GHCR](https://img.shields.io/badge/GHCR-container-blue?logo=docker)](https://github.com/mike840609/assets_tracker/pkgs/container/assets_tracker)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mike840609/assets_tracker)

[English](./README.md) | [繁體中文](./README.zh-TW.md)

A self-hosted, multi-currency net worth and investment tracker for people who want a private, unified view of their finances.

[Live Demo](https://astt.app) · [Quick Start](#quick-start) · [Deployment](./docs/DEPLOYMENT.md) · [Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md)

![Assets Tracker dashboard on desktop and mobile](./public/readme-hero.jpg)

## Why Assets Tracker?

- **Own your data** — run your own instance with PostgreSQL using Docker or deploy to Vercel and Neon.
- **One financial view** — combine bank accounts, brokerages, crypto wallets, property, liabilities, and options.
- **Multi-currency by design** — preserve original balances and normalize history into your preferred base currency.
- **Current market data** — refresh stocks, ETFs, crypto, options, and exchange rates through Yahoo Finance and CoinGecko.
- **Planning and automation** — track recurring cash flow, recurring investments, daily snapshots, goals, and FIRE projections.
- **Desktop and mobile** — responsive charts, keyboard navigation, themes, English/Traditional Chinese, and an installable PWA.

Built with Next.js 16, React 19, Prisma 7, PostgreSQL, Tailwind CSS 4, and NextAuth.js 5.

> Assets Tracker v1 is stable for personal self-hosting. Review the [data responsibility](#data-responsibility) notice before serving other users.

## Demo

<table>
  <tr>
    <th width="70%">Desktop</th>
    <th width="30%">Mobile</th>
  </tr>
  <tr>
    <td><img src="./public/readme-demo-desktop.gif" alt="Assets Tracker desktop dashboard demo"></td>
    <td><img src="./public/readme-demo-mobile.png" alt="Assets Tracker mobile dashboard"></td>
  </tr>
</table>

## How It Compares

Assets Tracker focuses on net worth and investments. If you mainly want double-entry bookkeeping or envelope budgeting, [Firefly III](https://github.com/firefly-iii/firefly-iii) and [Actual Budget](https://github.com/actualbudget/actual) are excellent at that — here is where each tool fits:

|                                         | Assets Tracker          | [Ghostfolio](https://github.com/ghostfolio/ghostfolio) | [Firefly III](https://github.com/firefly-iii/firefly-iii) | [Actual Budget](https://github.com/actualbudget/actual) |
| --------------------------------------- | ----------------------- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------- |
| Primary focus                           | Net worth + investments | Investment portfolio                                   | Bookkeeping & budgets                                     | Envelope budgeting                                      |
| Live market data (stocks, ETFs, crypto) | ✅                      | ✅                                                     | —                                                         | —                                                       |
| Options positions                       | ✅                      | —                                                      | —                                                         | —                                                       |
| Multi-currency accounts & history       | ✅                      | ✅                                                     | ✅                                                        | —                                                       |
| Recurring rules                         | ✅ cash + DCA investing | —                                                      | ✅ cash                                                   | ✅ cash                                                 |
| Goals & FIRE projections                | ✅                      | ✅                                                     | —                                                         | —                                                       |
| Budgeting / double-entry ledger         | —                       | —                                                      | ✅                                                        | ✅                                                      |
| License                                 | MIT                     | AGPL-3.0                                               | AGPL-3.0                                                  | MIT                                                     |

<sub>Summarized from each project's public documentation as of July 2026 — check their sites for the latest.</sub>

## Quick Start

### Prerequisites

- Node.js 24
- Docker with Docker Compose

### 1. Configure the environment

```bash
cp .env.example .env
```

Replace the generated-placeholder values for `AUTH_SECRET`, `AUTH_SELF_HOST_PASSWORD`, and `CRON_SECRET`. The example database URLs are ready for the bundled local PostgreSQL container.

The default self-host login is a single owner account protected by `AUTH_SELF_HOST_PASSWORD`. Google OAuth is optional for non-Vercel deployments. To enable it, set both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, then configure the OAuth client with:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Use your HTTPS production origin and the same `/api/auth/callback/google` path when deploying. Vercel production continues to require Google OAuth.

### 2. Install and initialize

```bash
corepack enable
pnpm install
pnpm db:up
pnpm exec prisma migrate deploy
```

### 3. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Stop the local database with `pnpm db:down`.

To explore the app with sample data, sign in with the one-click **Preview Login** (local development only) and run `pnpm seed:demo`. See the [development workflow](./docs/DEVELOPMENT.md) for details.

## Production Deployment

### Docker Compose

Set `NEXT_PUBLIC_APP_URL`, `POSTGRES_PASSWORD`, and the production secrets in `.env`, then pull the prebuilt application and migration images from GHCR and start the complete stack:

```bash
docker compose --profile full pull
docker compose --profile full up --no-build -d
```

To build both images from source instead:

```bash
docker compose --profile full up --build -d
```

The one-shot migration service must finish successfully before the application starts. PostgreSQL data is stored in the `postgres_data` volume.

### Vercel

Vercel with a separate Neon production/preview database is the supported hosted path. See the [deployment guide](./docs/DEPLOYMENT.md) for environment variables, migrations, preview isolation, cron scheduling, health checks, and non-Vercel hosting.

## Upgrading

Docker deployments:

```bash
git pull
docker compose --profile full pull
docker compose --profile full up --no-build -d
```

Source deployments:

```bash
git pull
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm build
```

Always back up the database before an upgrade and review the [release notes](https://github.com/mike840609/assets_tracker/releases).

## Documentation

- [Deployment and self-hosting](./docs/DEPLOYMENT.md)
- [Development workflow](./docs/DEVELOPMENT.md)
- [CI policy](./docs/CI.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Database and migrations](./docs/DATABASE.md)
- [Versioning](./docs/VERSIONING.md)
- [Environment variable reference](./.env.example)

## Development

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request; community participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Support and Security

Use [GitHub Issues](https://github.com/mike840609/assets_tracker/issues) for reproducible bugs and feature requests. Report vulnerabilities privately through the [Security Policy](./SECURITY.md), not a public issue.

## Data Responsibility

Each deployment owner controls its OAuth credentials, PostgreSQL database, backups, cron secret, and optional monitoring integrations. Assets Tracker is personal-tracking software, not financial, tax, or investment advice. Self-hosters are responsible for data security, privacy disclosures, regulatory compliance, backups, and access controls.

## License

Licensed under the [MIT License](./LICENSE) © 2026 Mike Tsai.
