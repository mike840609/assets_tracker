import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("E2E CI contract", () => {
  test("serializes CI tests that share the preview user", () => {
    expect(read("playwright.config.ts")).toContain("workers: process.env.CI ? 1 : 2");
  });

  test("runs the primary smoke suite for pull requests and master pushes without secrets", () => {
    const workflow = read(".github/workflows/e2e.yml");
    const e2eJob = workflow.slice(workflow.indexOf("\n  e2e:\n"));

    expect(workflow).toMatch(/^\s{2}pull_request:\s*$/m);
    expect(workflow).toMatch(/^\s{2}push:\s*$/m);
    expect(workflow).toMatch(/^\s{4}branches: \[master\]\s*$/m);
    expect(workflow).toMatch(/^\s{2}workflow_dispatch:\s*$/m);
    expect(workflow).not.toContain("deployment_status:");
    expect(workflow).not.toContain("secrets.");
    expect(e2eJob).toContain("name: Playwright smoke tests");
    expect(e2eJob).not.toMatch(/^\s{4}if:/m);
    expect(e2eJob).toContain("image: postgres:15-alpine");
    expect(e2eJob).toContain("pnpm exec prisma migrate deploy");
    expect(e2eJob).toContain("pnpm build");
    expect(e2eJob).toContain("pnpm start");
  });

  test("allows deployed-preview secrets only for trusted Vercel URLs and commits", () => {
    const workflow = read(".github/workflows/vercel-preview-e2e.yml");

    expect(workflow).toContain("deployment_status:");
    expect(workflow).toContain("github.event.deployment.environment != 'Production'");
    expect(workflow).toContain("pullRequest.head.repo?.full_name === `${owner}/${repo}`");
    expect(workflow).toContain('["OWNER", "MEMBER", "COLLABORATOR"]');
    expect(workflow).toContain('deployment.creator?.login === "vercel[bot]"');
    expect(workflow).toContain('deploymentStatus.creator?.login === "vercel[bot]"');
    expect(workflow).toContain('previewUrl.hostname.endsWith(".vercel.app")');
    expect(workflow).toContain('previewUrl.protocol === "https:"');
    expect(workflow).toContain("url: ${{ steps.trust.outputs.url }}");
    expect(workflow).toContain("PLAYWRIGHT_TEST_BASE_URL: ${{ needs.authorize.outputs.url }}");
    expect(workflow).toContain("name: Playwright preview smoke tests");
  });

  test.each(["README.md", "README.zh-TW.md"])(
    "%s scopes the E2E badge to master push runs",
    (readme) => {
      expect(read(readme)).toContain("e2e.yml/badge.svg?branch=master&event=push");
    },
  );
});
