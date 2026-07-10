# Open-source readiness design

## Goal

Make Assets Tracker ready for a public, self-hosted release while keeping the
maintainer's operational commitments intentionally small.

## Scope

- Add an MIT `LICENSE` with `Copyright (c) 2026 Mike Tsai`.
- Add contributor, security, and code-of-conduct documentation.
- Add GitHub bug-report and feature-request forms.
- Add a minimal Dependabot configuration for monthly GitHub Actions and npm
  dependency updates.
- Clarify the self-hosting model, data responsibility, financial disclaimer,
  and canonical app URL configuration in the README.
- Make metadata use `NEXT_PUBLIC_APP_URL` consistently when it is configured.
- Limit GitHub Actions to read-only repository contents by default.

## Non-goals

- No support SLA, hosted-service privacy policy, or funding program.
- No automatic releases, dependency auto-merge, or new deployment platform.
- No changes to GitHub repository settings such as visibility, branch rules,
  secret scanning, or CodeQL configuration; these require a maintainer action
  in GitHub.

## Documentation and community files

`CONTRIBUTING.md` will use the existing pnpm, Docker PostgreSQL, and validation
commands. It will state that contributors should not commit `.env` files or
credentials, and will link to the security policy for vulnerabilities.

`SECURITY.md` will direct reporters to the repository owner's private GitHub
security-advisory reporting channel. It will request a reproducible report and
ask reporters not to disclose vulnerabilities publicly before a fix is
available.

`CODE_OF_CONDUCT.md` will use the Contributor Covenant 2.1 text with a contact
route that does not expose a personal email address: GitHub private reporting.

Issue forms will collect a concise reproduction for bugs and a problem,
proposed outcome, and alternatives for feature requests.

## Self-hosting and configuration

The README will make explicit that a self-hoster supplies and controls their
Google OAuth credentials, PostgreSQL database, deployment, cron secret, and
optional Vercel/Sentry integrations. It will point readers to `.env.example`
as the complete configuration reference.

The README will state that the application is software for personal tracking,
not financial advice, and that a self-hoster is responsible for their own
users' data, security, compliance, and privacy disclosures.

The public app URL must be set with `NEXT_PUBLIC_APP_URL` for a deployed
instance. The application metadata will derive both `metadataBase` and the
Open Graph URL from this value, using the current deployment URL only as a
fallback for the maintainer's live instance.

## Automation and security

Dependabot will open monthly update pull requests for npm and GitHub Actions.
The existing CI and E2E workflows will declare `permissions: contents: read`,
which is sufficient for checkout and prevents accidental write permissions.

## Verification

Run `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit`, and `pnpm build`
with the documented placeholder environment values. Confirm that all new YAML
and Markdown files are formatted and that no local `.env` files are tracked.
