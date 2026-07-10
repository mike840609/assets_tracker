# Open-source Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Assets Tracker for a public, self-hosted release with clear licensing, contributor guidance, safe defaults, and documented deployment responsibility.

**Architecture:** Community policy, issue forms, and dependency-update configuration live under the repository root and `.github/`. A tiny URL helper centralizes the deployed application URL used by root metadata; the README describes how self-hosters set it. Existing workflows retain their jobs and triggers while explicitly receiving read-only repository access.

**Tech Stack:** Markdown, GitHub issue forms and Actions YAML, Dependabot, TypeScript, Next.js 16 Metadata API, Vitest, pnpm.

## Global Constraints

- Use the exact license notice: `Copyright (c) 2026 Mike Tsai`.
- Keep the project self-hosted; do not promise a support SLA or operate a hosted-service privacy policy.
- Do not add release automation, dependency auto-merge, a new deployment platform, or GitHub repository-setting changes.
- Keep `package.json` private because this is not an npm package.
- Do not commit `.env` files or credentials.
- Preserve the existing workflow triggers and jobs; add only `permissions: contents: read`.

---

### Task 1: Add licensing, contribution, security, and conduct policies

**Files:**

- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`

**Interfaces:**

- Consumes: the README's existing `pnpm` setup and validation commands.
- Produces: public repository policy documents linked by the README and GitHub community profile.

- [ ] **Step 1: Create the MIT license file**

Add the standard MIT license text, headed by:

```text
MIT License

Copyright (c) 2026 Mike Tsai
```

- [ ] **Step 2: Add contributor instructions**

Create `CONTRIBUTING.md` with these operational rules:

```markdown
# Contributing

## Development

1. Copy `.env.example` to `.env` and provide your own local credentials.
2. Start PostgreSQL with `pnpm db:up`.
3. Sync the schema with `pnpm exec prisma db push`.
4. Start the app with `pnpm dev`.

Never commit `.env`, `.env.local`, database exports, or credentials. Report vulnerabilities through [the security policy](SECURITY.md), not a public issue.

## Before opening a pull request

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit`. Update tests and documentation when the change affects behavior.
```

- [ ] **Step 3: Add private vulnerability-reporting policy**

Create `SECURITY.md` with this reporting route and disclosure expectation:

```markdown
# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the repository's **Security** tab using **Report a vulnerability**. Do not open a public issue before a fix or mitigation is available.

Include the affected version or commit, reproduction steps, impact, and any suggested mitigation. You will receive an acknowledgement as soon as the maintainer is able to review the report.
```

- [ ] **Step 4: Add the Contributor Covenant 2.1**

Create `CODE_OF_CONDUCT.md` using the complete Contributor Covenant version 2.1 text. Set its contact sentence to: `Instances of abusive, harassing, or otherwise unacceptable behavior may be reported through GitHub's private vulnerability reporting flow described in SECURITY.md.`

- [ ] **Step 5: Validate policy files**

Run:

```bash
git diff --check -- LICENSE
pnpm exec prettier --check CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md
```

Expected: `git diff --check` reports no whitespace errors and Prettier reports
the Markdown files are formatted.

- [ ] **Step 6: Commit the policy files**

```bash
git add LICENSE CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md
git commit -m "docs: add open-source community policies"
```

### Task 2: Add public contribution intake and dependency maintenance

**Files:**

- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/dependabot.yml`

**Interfaces:**

- Consumes: GitHub's issue-form and Dependabot YAML schemas.
- Produces: structured public issue submission and monthly update pull requests.

- [ ] **Step 1: Create the bug-report form**

Create `.github/ISSUE_TEMPLATE/bug_report.yml` with required summary, reproduction steps, expected behavior, actual behavior, and environment fields. Set the form metadata to:

```yaml
name: Bug report
description: Report reproducible behavior that differs from expectations.
labels: [bug]
body:
  - type: markdown
    attributes:
      value: "Please do not include account balances, OAuth credentials, database URLs, or other sensitive information."
```

- [ ] **Step 2: Create the feature-request form**

Create `.github/ISSUE_TEMPLATE/feature_request.yml` with required problem, proposed outcome, alternatives considered, and additional context fields. Set the form metadata to:

```yaml
name: Feature request
description: Propose an improvement for self-hosted Assets Tracker instances.
labels: [enhancement]
```

- [ ] **Step 3: Configure monthly Dependabot updates**

Create `.github/dependabot.yml` with separate monthly ecosystems:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
```

- [ ] **Step 4: Validate configuration structure**

Run: `pnpm exec prettier --check .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml .github/dependabot.yml`

Expected: Prettier reports all three YAML files are formatted.

- [ ] **Step 5: Commit the GitHub configuration**

```bash
git add .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml .github/dependabot.yml
git commit -m "chore: add open-source repository automation"
```

### Task 3: Make canonical metadata configurable with a tested URL helper

**Files:**

- Create: `src/lib/app-url.ts`
- Create: `tests/unit/app-url.test.ts`
- Modify: `src/app/layout.tsx:15-46`
- Modify: `.env.example`

**Interfaces:**

- Consumes: optional `NEXT_PUBLIC_APP_URL` environment variable.
- Produces: `getAppUrl(value?: string): URL`, returning the configured absolute URL or `https://assets-tracker-ct.vercel.app` as a fallback.

- [ ] **Step 1: Write the failing URL-helper tests**

Create `tests/unit/app-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAppUrl } from "@/lib/app-url";

describe("getAppUrl", () => {
  it("uses the production URL when no override is provided", () => {
    expect(getAppUrl().toString()).toBe("https://assets-tracker-ct.vercel.app/");
  });

  it("uses a self-hoster's configured URL", () => {
    expect(getAppUrl("https://tracker.example.com").toString()).toBe(
      "https://tracker.example.com/",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit -- tests/unit/app-url.test.ts`

Expected: FAIL because `@/lib/app-url` does not exist.

- [ ] **Step 3: Implement the minimal URL helper**

Create `src/lib/app-url.ts`:

```ts
const DEFAULT_APP_URL = "https://assets-tracker-ct.vercel.app";

export function getAppUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
  return new URL(value || DEFAULT_APP_URL);
}
```

- [ ] **Step 4: Update root metadata to use one canonical URL**

In `src/app/layout.tsx`, import `getAppUrl`, create `const appUrl = getAppUrl();` before `metadata`, and replace both existing hard-coded metadata URLs:

```ts
metadataBase: appUrl,
// …
openGraph: {
  // …
  url: appUrl,
```

Add this commented configuration entry to `.env.example` after the auth callback URL:

```env
# Public canonical URL for metadata and social sharing (required for deployments)
# NEXT_PUBLIC_APP_URL="https://tracker.example.com"
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm test:unit -- tests/unit/app-url.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 6: Commit the metadata configuration**

```bash
git add src/lib/app-url.ts tests/unit/app-url.test.ts src/app/layout.tsx .env.example
git commit -m "feat: configure canonical app metadata URL"
```

### Task 4: Document self-hosting and apply read-only workflow permissions

**Files:**

- Modify: `README.md:42-77, 228-299`
- Modify: `.github/workflows/ci.yml:1-19`
- Modify: `.github/workflows/e2e.yml:1-12`

**Interfaces:**

- Consumes: `NEXT_PUBLIC_APP_URL`, `.env.example`, the community-policy documents, and existing workflow triggers.
- Produces: accurate self-hosting documentation and workflows with explicit read-only access.

- [ ] **Step 1: Add a self-hosting responsibility section to the README**

After the environment-variable section, add a `## Self-hosting and data responsibility` section stating that each deployment owner provides and controls its own Google OAuth credentials, PostgreSQL database, deployment, cron secret, and optional Vercel/Sentry integrations. State that `NEXT_PUBLIC_APP_URL` must be the deployed public URL and `.env.example` is the complete configuration reference.

Add this disclaimer:

```markdown
Assets Tracker is personal-tracking software, not financial, tax, or investment advice. Self-hosters are responsible for their users' data security, privacy disclosures, regulatory compliance, backups, and access controls.
```

- [ ] **Step 2: Link public project policies from the README**

Append a `## Contributing and security` section after Versioning:

```markdown
Contributions are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md). Please report vulnerabilities privately under the [Security Policy](./SECURITY.md). Community participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
```

- [ ] **Step 3: Make CI workflow permissions explicit**

Add this top-level block after each workflow's `on:` block and before `concurrency:`:

```yaml
permissions:
  contents: read
```

Do not alter any existing jobs, conditions, triggers, or secrets.

- [ ] **Step 4: Run formatting and repository validation**

Run:

```bash
pnpm format:check
pnpm typecheck
pnpm test:unit
DATABASE_URL="postgresql://ci:ci@localhost:5432/ci" AUTH_SECRET=x AUTH_GOOGLE_ID=x AUTH_GOOGLE_SECRET=x CRON_SECRET=x pnpm build
git ls-files | rg '(^|/)(\.env|.*\.pem|.*\.key|.*\.p12|.*credentials|.*secret)' || true
```

Expected: formatting, type checking, all unit tests, and the production build pass; the tracked-file scan prints only `.env.example`.

- [ ] **Step 5: Commit the final documentation and workflow changes**

```bash
git add README.md .github/workflows/ci.yml .github/workflows/e2e.yml
git commit -m "docs: clarify self-hosted open-source use"
```
