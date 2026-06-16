# Versioning

Assets Tracker follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

`src/lib/changelog.ts` is the single source of truth. `APP_VERSION = CHANGELOG[0].version`
drives the version shown in the sidebar, the Settings "Version" card, and the `/changelog`
timeline. Keep `package.json`'s `version` field in lockstep with the top entry.

## Which number to bump

Look at the release's change types and **bump by the highest-impact change**:

| Bump  | Example         | When                                           | Change types |
| ----- | --------------- | ---------------------------------------------- | ------------ |
| PATCH | `0.6.0`→`0.6.1` | Bug fixes only, no behavior change             | only `fixed` |
| MINOR | `0.6.0`→`0.7.0` | New feature, backward-compatible               | any `added`  |
| MAJOR | `0.x`→`1.0.0`   | Breaking change, or "stable enough to call v1" | —            |

Rule of thumb: **any `added` → MINOR, otherwise → PATCH.**

### Pre-1.0 (where we are now)

Strict SemVer relaxes the rules below `1.0.0`, but we keep it simple and use the table
above (feature → MINOR, fix → PATCH). Reserve `1.0.0` for when the data model and core
flows are considered stable.

## Shipping a release

1. Prepend a `Release` to `CHANGELOG` in `src/lib/changelog.ts`. Group changes as
   `added` / `improved` / `fixed`; author `text` bilingually (`en-US` + `zh-TW`).
2. Bump `package.json` `version` to match the new top entry.

That single edit updates every surface that reads `APP_VERSION` / `CHANGELOG`.

## Conventions we lean on

- **Change groups** mirror [Keep a Changelog](https://keepachangelog.com) (Added / Changed /
  Fixed / Removed / Security). We currently use Added / Improved / Fixed; extend the
  `ChangeType` union if Security or Removed buckets are ever needed.
- **Commits** already use [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `chore:`). That is the on-ramp if we later automate changelog/version
  bumps (e.g. `changesets` or `semantic-release`). For now, entries are hand-authored
  because the curated, bilingual notes read better than generated ones.
