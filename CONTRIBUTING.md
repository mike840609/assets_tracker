# Contributing

Thank you for improving Assets Tracker. Use GitHub Issues for reproducible bugs and focused feature proposals. Security vulnerabilities must follow [SECURITY.md](./SECURITY.md) instead of a public issue.

## Development setup

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:up
pnpm exec prisma migrate deploy
pnpm dev
```

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for tests, builds, database changes, worktrees, and diagnostics.

## Pull requests

- Keep each pull request focused on one outcome.
- Add or update tests when behavior changes.
- Update user-facing documentation and the bilingual changelog when appropriate.
- Create Prisma migrations for persistent schema changes; do not use `db push` as an upgrade mechanism.
- Avoid committing generated files, environment files, reports, exports, or credentials.

## Before opening a pull request

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

By participating, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Contributions are licensed under the repository's [MIT License](./LICENSE).
