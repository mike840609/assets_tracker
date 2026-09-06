import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<void>;

function githubScript(stepName: string) {
  const workflow = read(".github/workflows/vercel-preview-e2e.yml");
  const marker = `      - name: ${stepName}`;
  const stepStart = workflow.indexOf(marker);
  if (stepStart === -1) throw new Error(`Missing workflow step: ${stepName}`);
  const scriptMarker = "          script: |\n";
  const scriptStart = workflow.indexOf(scriptMarker, stepStart);
  if (scriptStart === -1) throw new Error(`Missing script in workflow step: ${stepName}`);
  const nextStep = workflow.indexOf("\n      - ", scriptStart + scriptMarker.length);
  const nextJob = workflow.indexOf("\n  e2e:\n", scriptStart + scriptMarker.length);
  const blockEnd = [nextStep, nextJob].filter((index) => index !== -1).sort((a, b) => a - b)[0];
  const block = workflow.slice(scriptStart + scriptMarker.length, blockEnd ?? workflow.length);
  return block
    .split("\n")
    .map((line) => line.replace(/^ {12}/, ""))
    .join("\n");
}

type PullRequest = {
  number: number;
  state: "open" | "closed";
  author_association: string;
  head: { sha: string; repo: { full_name: string } | null };
};

const pullRequest = (
  number: number,
  sha: string,
  overrides: Partial<PullRequest> = {},
): PullRequest => ({
  number,
  state: "open",
  author_association: "MEMBER",
  head: { sha, repo: { full_name: "acme/astt" } },
  ...overrides,
});

async function runPreviewScript(
  stepName: string,
  options: {
    deploymentSha: string;
    associated?: PullRequest[];
    refreshed?: Record<number, PullRequest>;
    deploymentCreator?: string;
    statusCreator?: string;
    url?: string;
    prNumber?: string;
    deploymentId?: number;
    deployments?: { id: number; environment: string }[];
    refreshFails?: boolean;
  },
) {
  const outputs = new Map<string, string>();
  const failures: string[] = [];
  const warnings: string[] = [];
  const associated = options.associated ?? [];
  const refreshed = options.refreshed ?? {};
  const deploymentId = options.deploymentId ?? 100;
  const deployments = options.deployments ?? [];
  const rest = {
    repos: {
      listPullRequestsAssociatedWithCommit() {},
      listDeployments() {},
    },
    pulls: {
      get: async ({ pull_number }: { pull_number: number }) => {
        if (options.refreshFails) throw new Error("API is unavailable");
        return { data: refreshed[pull_number] };
      },
    },
  };
  const github = {
    paginate: async (endpoint: unknown, parameters: Record<string, unknown>) => {
      if (endpoint === rest.repos.listDeployments) {
        expect(parameters.sha).toBe(options.deploymentSha);
        return deployments;
      }
      expect(parameters.commit_sha).toBe(options.deploymentSha);
      return associated;
    },
    rest,
  };
  const context = {
    repo: { owner: "acme", repo: "astt" },
    payload: {
      deployment: {
        id: deploymentId,
        sha: options.deploymentSha,
        creator: { login: options.deploymentCreator ?? "vercel[bot]" },
      },
      deployment_status: {
        creator: { login: options.statusCreator ?? "vercel[bot]" },
        environment_url: options.url ?? "https://astt-git-feature-acme.vercel.app/path",
      },
    },
  };
  const core = {
    notice() {},
    warning(message: string) {
      warnings.push(message);
    },
    setFailed(message: string) {
      failures.push(message);
    },
    setOutput(name: string, value: string) {
      outputs.set(name, value);
    },
  };
  const process = {
    env: {
      DEPLOYMENT_SHA: options.deploymentSha,
      PR_NUMBER: options.prNumber ?? "",
    },
  };

  await new AsyncFunction("github", "context", "core", "process", githubScript(stepName))(
    github,
    context,
    core,
    process,
  );
  return { outputs, failures, warnings };
}

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

  test("rejects a deployment after its pull request head advances", async () => {
    const associated = pullRequest(17, "old-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "old-sha",
      associated: [associated],
      refreshed: { 17: pullRequest(17, "new-sha") },
    });

    expect(result.outputs.get("trusted")).toBe("false");
    expect(result.outputs.get("url")).toBe("");
    expect(result.outputs.get("pr")).toBe("");
  });

  test("rejects a deployment for a closed pull request", async () => {
    const associated = pullRequest(17, "deploy-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [associated],
      refreshed: { 17: pullRequest(17, "deploy-sha", { state: "closed" }) },
    });

    expect(result.outputs.get("trusted")).toBe("false");
  });

  test("authorizes the current head of an open trusted pull request", async () => {
    const current = pullRequest(17, "deploy-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [current],
      refreshed: { 17: current },
    });

    expect(result.outputs.get("trusted")).toBe("true");
    expect(result.outputs.get("url")).toBe("https://astt-git-feature-acme.vercel.app");
    expect(result.outputs.get("pr")).toBe("17");
  });

  test("uses the exact-head pull request for independent stacked-PR serialization", async () => {
    const outer = pullRequest(22, "outer-sha");
    const inner = pullRequest(17, "deploy-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [outer, inner],
      refreshed: { 17: inner, 22: outer },
    });

    expect(result.outputs.get("trusted")).toBe("true");
    expect(result.outputs.get("pr")).toBe("17");
  });

  test("rejects a deployment with no exact-head pull request", async () => {
    const missing = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [pullRequest(22, "other-sha")],
    });

    expect(missing.outputs.get("trusted")).toBe("false");
  });

  test("picks the same pull request every time several share one head commit", async () => {
    const first = pullRequest(17, "deploy-sha");
    const second = pullRequest(22, "deploy-sha");
    // Both are open, same-repository and at the deployed commit, so refusing to
    // choose would drop the check; the pick only has to be stable across the
    // repeated deployments of this commit that key on it.
    const forward = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [first, second],
      refreshed: { 17: first, 22: second },
    });
    const reversed = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [second, first],
      refreshed: { 17: first, 22: second },
    });

    expect(forward.outputs.get("trusted")).toBe("true");
    expect(forward.outputs.get("pr")).toBe("17");
    expect(reversed.outputs.get("pr")).toBe("17");
  });

  test("refuses to authorize when a candidate cannot be re-read", async () => {
    const current = pullRequest(17, "deploy-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [current],
      refreshed: { 17: current },
      refreshFails: true,
    });

    expect(result.outputs.get("trusted")).toBe("false");
    expect(result.failures).toEqual([]);
    expect(result.warnings.join(" ")).toContain("Could not refresh pull request #17");
  });

  test("skips a redeployment of a commit that already has a newer deployment", async () => {
    const current = pullRequest(17, "deploy-sha");
    const options = {
      deploymentSha: "deploy-sha",
      associated: [current],
      refreshed: { 17: current },
    };
    const superseded = await runPreviewScript("Allow only trusted same-repository pull requests", {
      ...options,
      deploymentId: 100,
      deployments: [
        { id: 100, environment: "Preview" },
        { id: 101, environment: "Preview" },
      ],
    });
    const newest = await runPreviewScript("Allow only trusted same-repository pull requests", {
      ...options,
      deploymentId: 101,
      deployments: [
        { id: 100, environment: "Preview" },
        { id: 101, environment: "Preview" },
      ],
    });

    expect(superseded.outputs.get("trusted")).toBe("false");
    expect(newest.outputs.get("trusted")).toBe("true");
  });

  test("ignores the production deployment of the same commit", async () => {
    const current = pullRequest(17, "deploy-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [current],
      refreshed: { 17: current },
      deploymentId: 100,
      deployments: [
        { id: 100, environment: "Preview" },
        { id: 200, environment: "Production" },
      ],
    });

    expect(result.outputs.get("trusted")).toBe("true");
  });

  test.each([
    {
      name: "foreign repository",
      pr: pullRequest(17, "deploy-sha", {
        head: { sha: "deploy-sha", repo: { full_name: "fork/astt" } },
      }),
      url: undefined,
    },
    {
      name: "untrusted author",
      pr: pullRequest(17, "deploy-sha", { author_association: "CONTRIBUTOR" }),
      url: undefined,
    },
    { name: "non-HTTPS URL", pr: pullRequest(17, "deploy-sha"), url: "http://astt.vercel.app" },
    {
      name: "lookalike URL",
      pr: pullRequest(17, "deploy-sha"),
      url: "https://vercel.app.attacker.example",
    },
  ])("rejects $name", async ({ pr, url }) => {
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [pr],
      refreshed: { 17: pr },
      url,
    });

    expect(result.outputs.get("trusted")).toBe("false");
  });

  test.each([
    { deploymentCreator: "attacker", statusCreator: "vercel[bot]" },
    { deploymentCreator: "vercel[bot]", statusCreator: "attacker" },
  ])("rejects a non-Vercel deployment source", async (creators) => {
    const current = pullRequest(17, "deploy-sha");
    const result = await runPreviewScript("Allow only trusted same-repository pull requests", {
      deploymentSha: "deploy-sha",
      associated: [current],
      refreshed: { 17: current },
      ...creators,
    });

    expect(result.outputs.get("trusted")).toBe("false");
  });

  test("marks a stale commit before setup", async () => {
    const result = await runPreviewScript("Check preview freshness before setup", {
      deploymentSha: "deploy-sha",
      prNumber: "17",
      refreshed: { 17: pullRequest(17, "new-sha") },
    });

    expect(result.outputs.get("fresh")).toBe("false");
  });

  test("cleanly skips the final gate when the selected pull request head changes during setup", async () => {
    const result = await runPreviewScript("Revalidate preview commit", {
      deploymentSha: "deploy-sha",
      prNumber: "17",
      refreshed: { 17: pullRequest(17, "new-sha") },
    });

    expect(result.outputs.get("fresh")).toBe("false");
    expect(result.failures).toEqual([]);
  });

  // A job whose steps all skip reports green, so a freshness check that answered
  // "false" unconditionally would silently retire preview E2E while every other
  // test in this file still passed. These pin the answer that keeps it running.
  test.each(["Check preview freshness before setup", "Revalidate preview commit"])(
    "%s lets a still-current preview through",
    async (stepName) => {
      const result = await runPreviewScript(stepName, {
        deploymentSha: "deploy-sha",
        prNumber: "17",
        refreshed: { 17: pullRequest(17, "deploy-sha") },
      });

      expect(result.outputs.get("fresh")).toBe("true");
      expect(result.failures).toEqual([]);
    },
  );

  test.each(["Check preview freshness before setup", "Revalidate preview commit"])(
    "%s runs the suite rather than failing when the API is unreachable",
    async (stepName) => {
      const result = await runPreviewScript(stepName, {
        deploymentSha: "deploy-sha",
        prNumber: "17",
        refreshed: { 17: pullRequest(17, "deploy-sha") },
        refreshFails: true,
      });

      expect(result.outputs.get("fresh")).toBe("true");
      expect(result.failures).toEqual([]);
      expect(result.warnings.join(" ")).toContain("Could not re-read pull request #17");
    },
  );

  test.each(["Check preview freshness before setup", "Revalidate preview commit"])(
    "%s stops a run whose pull request closed",
    async (stepName) => {
      const result = await runPreviewScript(stepName, {
        deploymentSha: "deploy-sha",
        prNumber: "17",
        refreshed: { 17: pullRequest(17, "deploy-sha", { state: "closed" }) },
      });

      expect(result.outputs.get("fresh")).toBe("false");
    },
  );

  test("serializes every pending run per pull request without cancellation", () => {
    const workflow = read(".github/workflows/vercel-preview-e2e.yml");

    expect(workflow).toContain("group: vercel-preview-e2e-pr-${{ needs.authorize.outputs.pr }}");
    expect(workflow).toContain("queue: max");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  test("checks freshness before costly setup and again immediately before Playwright", () => {
    const workflow = read(".github/workflows/vercel-preview-e2e.yml");
    const e2eJob = workflow.slice(workflow.indexOf("\n  e2e:\n"));
    const entryGate = e2eJob.indexOf("- name: Check preview freshness before setup");
    const checkout = e2eJob.indexOf("uses: actions/checkout@v5");
    const finalGate = e2eJob.indexOf("- name: Revalidate preview commit");
    const playwright = e2eJob.indexOf("- name: Run deployment check");

    expect(entryGate).toBeGreaterThan(-1);
    expect(entryGate).toBeLessThan(checkout);
    expect(finalGate).toBeGreaterThan(checkout);
    expect(finalGate).toBeLessThan(playwright);
    expect(e2eJob.slice(finalGate, playwright)).toContain("id: final-freshness");
    expect(e2eJob.slice(playwright, e2eJob.indexOf("- name: Upload Playwright report"))).toContain(
      "steps.final-freshness.outputs.fresh == 'true'",
    );

    const costlySetupSteps = [
      "- uses: actions/checkout@v5",
      "- uses: pnpm/action-setup@v4",
      "- name: Set up Node.js",
      "- name: Install dependencies",
      "- name: Resolve Playwright version",
      "- name: Cache Playwright browser",
      "- name: Install Playwright browser (cache miss)",
      "- name: Install Playwright system dependencies (cache hit)",
    ];
    for (const marker of costlySetupSteps) {
      const stepStart = e2eJob.indexOf(marker);
      expect(stepStart).toBeGreaterThan(-1);
      const nextStep = e2eJob.indexOf("\n      - ", stepStart + marker.length);
      expect(e2eJob.slice(stepStart, nextStep)).toContain(
        "steps.freshness.outputs.fresh == 'true'",
      );
    }
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
