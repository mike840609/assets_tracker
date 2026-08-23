import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  initializeSentryClient: vi.fn(),
  init: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
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

vi.mock("@/lib/sentry-client-init", () => ({
  initializeSentryClient: mocks.initializeSentryClient,
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

  it("defers browser telemetry init to the gated client initializer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");

    await import("@/instrumentation-client");

    await vi.waitFor(() => {
      expect(mocks.initializeSentryClient).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://public@example.ingest.sentry.io/1",
          tracesSampleRate: 0,
          spanStreamingIntegration: expect.any(Function),
        }),
      );
    });
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it("does not import the Sentry SDK when no DSN is configured", async () => {
    await import("@/instrumentation-client");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.initializeSentryClient).not.toHaveBeenCalled();
    expect(mocks.init).not.toHaveBeenCalled();
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
