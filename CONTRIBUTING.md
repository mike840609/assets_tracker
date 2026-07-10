# Contributing

## Development

1. Copy `.env.example` to `.env` and provide your own local credentials.
2. Start PostgreSQL with `pnpm db:up`.
3. Sync the schema with `pnpm exec prisma db push`.
4. Start the app with `pnpm dev`.

Never commit `.env`, `.env.local`, database exports, or credentials. Report
vulnerabilities through [the security policy](SECURITY.md), not a public issue.

## Before opening a pull request

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit`.
Update tests and documentation when the change affects behavior.
