import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureRequestError: mocks.captureRequestError,
  captureRouterTransitionStart: mocks.captureRouterTransitionStart,
  init: mocks.init,
  spanStreamingIntegration: vi.fn(() => ({ name: "SpanStreaming" })),
  withStreamedSpan: <T extends object>(callback: T) => {
    Object.defineProperty(callback, "_streamed", { value: true });
    return callback;
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { info: mocks.logInfo },
}));

type SentryOptions = {
  beforeSendSpan?: unknown;
  beforeSendTransaction?: unknown;
  integrations?: unknown;
  traceLifecycle?: unknown;
};

function latestSentryOptions(): SentryOptions {
  const call = mocks.init.mock.calls.at(-1);
  if (!call) throw new Error("Expected Sentry.init to be called");
  return call[0] as SentryOptions;
}

describe("Sentry telemetry privacy hooks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not initialize browser Sentry without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    const { onRouterTransitionStart } = await import("@/instrumentation-client");

    expect(onRouterTransitionStart).toEqual(expect.any(Function));
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it("keeps always-present browser entries free of runtime Sentry imports", () => {
    for (const path of [
      "src/instrumentation-client.ts",
      "src/app/global-error.tsx",
      "src/app/(main)/error.tsx",
    ]) {
      expect(readFileSync(path, "utf8")).not.toContain('import * as Sentry from "@sentry/nextjs"');
    }
  });

  it("registers transaction and span scrubbers for browser telemetry", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");

    const { onRouterTransitionStart } = await import("@/instrumentation-client");

    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled());

    onRouterTransitionStart("/accounts", "push");
    await vi.waitFor(() =>
      expect(mocks.captureRouterTransitionStart).toHaveBeenCalledWith("/accounts", "push"),
    );

    expect(latestSentryOptions()).toMatchObject({
      beforeSendSpan: expect.any(Function),
      beforeSendTransaction: expect.any(Function),
      integrations: [{ name: "SpanStreaming" }],
      traceLifecycle: "stream",
    });
  });

  it("registers transaction and span scrubbers for Node telemetry", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("SENTRY_DSN", "https://secret@example.ingest.sentry.io/2");
    const { register } = await import("@/instrumentation");

    await register();

    expect(latestSentryOptions()).toMatchObject({
      beforeSendSpan: expect.any(Function),
      beforeSendTransaction: expect.any(Function),
      traceLifecycle: "stream",
    });
  });

  it("registers transaction and span scrubbers for Edge telemetry", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("SENTRY_DSN", "https://secret@example.ingest.sentry.io/3");
    const { register } = await import("@/instrumentation");

    await register();

    expect(latestSentryOptions()).toMatchObject({
      beforeSendSpan: expect.any(Function),
      beforeSendTransaction: expect.any(Function),
      traceLifecycle: "stream",
    });
  });
});
