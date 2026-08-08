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

  test("runs the serial PostgreSQL integration suite against a dedicated test database", () => {
    const workflow = read(".github/workflows/ci.yml");
    const integrationJob = workflow.slice(workflow.indexOf("\n  integration:\n"));

    expect(integrationJob).toContain("name: PostgreSQL integration tests");
    expect(integrationJob).toContain("POSTGRES_DB: asset_app_asset_tracker_test");
    expect(integrationJob).toContain(
      "postgresql://postgres:postgres@localhost:5432/asset_app_asset_tracker_test?sslmode=disable",
    );
    expect(integrationJob).toContain("pnpm exec prisma migrate deploy");
    expect(integrationJob).toContain("pnpm test:integration");
  });

  test("enables public Demo only in the isolated E2E environment", () => {
    const isolatedWorkflow = read(".github/workflows/e2e.yml");
    const deployedPreviewWorkflow = read(".github/workflows/vercel-preview-e2e.yml");

    expect(isolatedWorkflow).toContain('PUBLIC_DEMO_ENABLED: "true"');
    expect(isolatedWorkflow).toContain('E2E_PUBLIC_DEMO: "1"');
    expect(deployedPreviewWorkflow).not.toContain("E2E_PUBLIC_DEMO");
  });

  test("separates authenticated and empty-state public Demo Playwright projects", () => {
    const config = read("playwright.config.ts");

    expect(config).toContain("testIgnore: /public-demo\\.spec\\.ts/");
    expect(config).toContain('name: "Public Demo Desktop"');
    expect(config).toContain('name: "Public Demo Mobile zh-TW"');
    expect(config).toContain("storageState: { cookies: [], origins: [] }");
    expect(config).toContain('locale: "zh-TW"');
  });

  test("disables retained artifacts for both public Demo projects", () => {
    const config = read("playwright.config.ts");
    const publicDesktop = config.slice(
      config.indexOf('name: "Public Demo Desktop"'),
      config.indexOf('name: "Public Demo Mobile zh-TW"'),
    );
    const publicMobile = config.slice(config.indexOf('name: "Public Demo Mobile zh-TW"'));

    for (const publicProject of [publicDesktop, publicMobile]) {
      expect(publicProject).toContain('trace: "off"');
      expect(publicProject).toContain('screenshot: "off"');
      expect(publicProject).toContain('video: "off"');
    }

    expect(config).toContain('trace: "on-first-retry"');
    expect(config).toContain('screenshot: "only-on-failure"');
  });

  test("keeps the public Demo CI run out of retained Playwright reports", () => {
    const config = read("playwright.config.ts");
    const workflow = read(".github/workflows/e2e.yml");
    const publicRun = workflow.slice(
      workflow.indexOf("- name: Run public Demo E2E tests without retained artifacts"),
      workflow.indexOf("- name: Upload Playwright report"),
    );

    expect(config).toContain('process.env.E2E_PUBLIC_DEMO_NO_ARTIFACTS === "1"');
    expect(config).toContain('[["line"]]');
    expect(config).toContain('outputDir: "/tmp/asset-tracker-public-demo-test-results"');
    expect(workflow).toContain("- name: Run authenticated E2E tests");
    expect(publicRun).toContain('E2E_PUBLIC_DEMO_NO_ARTIFACTS: "1"');
    expect(publicRun).toContain('--project="Public Demo Desktop"');
    expect(publicRun).toContain('--project="Public Demo Mobile zh-TW"');
    expect(publicRun).not.toContain("playwright-report");
    expect(workflow).toContain("path: playwright-report/");
  });

  test("keeps public Demo API assertions out of sensitive object and array diffs", () => {
    const publicSpec = read("tests/e2e/public-demo.spec.ts");

    expect(publicSpec).not.toContain(".toEqual(");
    expect(publicSpec).not.toContain(".toMatchObject(");
    expect(publicSpec).not.toContain("expect(resetAccounts).toHaveLength");
    expect(publicSpec).toContain("expect(secondWorkspaceUnchanged).toBe(true)");
    expect(publicSpec).toContain("expect(markerTransferredToFormalAccount).toBe(false)");
  });

  test("omits public Demo projects for optional remote smoke unless explicitly enabled", () => {
    const config = read("playwright.config.ts");

    expect(config).toContain(
      '!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.E2E_PUBLIC_DEMO === "1"',
    );
    expect(config).toContain("...(ENABLE_PUBLIC_DEMO_PROJECTS");
  });

  test("cleans Demo users through the relation only for local disposable databases", () => {
    const teardown = read("tests/e2e/global-teardown.ts");

    expect(teardown).toContain('["localhost", "127.0.0.1"]');
    expect(teardown).toContain('DELETE FROM "User"');
    expect(teardown).toContain('SELECT "userId" FROM "DemoWorkspace"');
    expect(teardown.indexOf("await cleanupPublicDemoUsers()")).toBeLessThan(
      teardown.indexOf("if (!fs.existsSync(authFile)) return"),
    );
  });

  test.each(["README.md", "README.zh-TW.md"])(
    "%s scopes the E2E badge to master push runs",
    (readme) => {
      expect(read(readme)).toContain("e2e.yml/badge.svg?branch=master&event=push");
    },
  );

  test("documents CPU baselines, regression thresholds, and kill-switch response", () => {
    const deployment = read("docs/DEPLOYMENT.md");

    expect(deployment).toContain("database CPU utilization");
    expect(deployment).toContain("application compute CPU utilization");
    expect(deployment).toContain("24-hour pre-enable baseline window");
    expect(deployment).toContain("post-enable window");
    expect(deployment).toContain("exceeds the baseline by more than 10%");
    expect(deployment).toContain("PUBLIC_DEMO_ENABLED=false");
  });
});
