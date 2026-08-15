# Contributing

Thank you for improving astt. Use GitHub Issues for reproducible bugs and focused feature proposals. Security vulnerabilities must follow [SECURITY.md](./SECURITY.md) instead of a public issue.

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

## Writing the product name

- The product is **astt**, always lowercase — including at the start of a sentence. Never `ASTT` or `Astt`.
- Lowercase is what the domain, the npm package, and the container image path already are, the last two by specification rather than by choice. One spelling everywhere means no per-string judgement calls.
- If a sentence-initial lowercase reads badly, rewrite the sentence rather than capitalize; capitalizing once makes every later string an argument.
- The former name survives on purpose in identifiers users never read: the demo cookie, the integration test database, the repository slug, and the container image path. Renaming those breaks live sessions and existing deployments, so leave them as they are — a rename is not "unfinished" because they still say `asset_tracker`.

## Before opening a pull request

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

By participating, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Contributions are licensed under the repository's [MIT License](./LICENSE).
