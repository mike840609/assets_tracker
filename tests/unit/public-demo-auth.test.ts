import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_ERROR_CODES } from "@/lib/demo/demo-errors";

type CredentialsProvider = {
  id?: string;
  name?: string;
  authorize?: (credentials: Record<string, unknown>) => Promise<unknown>;
};

type CapturedAuthConfig = {
  providers: CredentialsProvider[];
  callbacks?: Record<string, unknown>;
};

const h = vi.hoisted(() => ({
  authConfig: null as CapturedAuthConfig | null,
  publicDemoEnabled: true,
  authenticateDemoTicket: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getAuthContext: vi.fn(),
  requestHeaders: new Headers(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  rateLimitCheckWithPrune: vi.fn(),
  rateLimitKeyForClientIp: vi.fn(() => "hmac:public-demo-start"),
  getClientIpFromHeaders: vi.fn(() => "203.0.113.7"),
  ensureDemoWorkspace: vi.fn(),
  createDemoLoginTicket: vi.fn(() => "signed-demo-ticket"),
}));

vi.mock("next-auth", () => ({
  default: (config: CapturedAuthConfig) => {
    h.authConfig = config;
    return { handlers: {}, auth: vi.fn(), signIn: h.signIn, signOut: h.signOut };
  },
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: CredentialsProvider) => ({ id: config.id ?? "credentials", ...config }),
}));

vi.mock("@/auth.config", () => ({ default: { providers: [] } }));
vi.mock("@/lib/auth-adapter", () => ({ customPrismaAdapter: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { upsert: vi.fn() } } }));
vi.mock("@/lib/env", () => ({
  AUTH_SECRET: "task-7-unit-secret",
  AUTH_SELF_HOST_PASSWORD: undefined,
  isGoogleAuthEnabled: true,
  isSelfHostAuthEnabled: false,
  isPreviewAuthEnabled: true,
  previewAuthRequiresPassword: false,
  PREVIEW_AUTH_PASSWORD: undefined,
  get isPublicDemoEnabled() {
    return h.publicDemoEnabled;
  },
}));
vi.mock("@/lib/demo/demo-service", () => ({
  authenticateDemoTicket: h.authenticateDemoTicket,
  ensureDemoWorkspace: h.ensureDemoWorkspace,
}));
vi.mock("@/lib/demo/demo-crypto", () => ({
  createDemoLoginTicket: h.createDemoLoginTicket,
}));
vi.mock("@/lib/auth-session", () => ({ getAuthContext: h.getAuthContext }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: h.getClientIpFromHeaders,
  rateLimitKeyForClientIp: h.rateLimitKeyForClientIp,
  rateLimitCheckWithPrune: h.rateLimitCheckWithPrune,
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => h.requestHeaders),
  cookies: vi.fn(async () => ({ get: h.cookieGet, set: h.cookieSet })),
}));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

async function loadAuthConfig(): Promise<CapturedAuthConfig> {
  h.authConfig = null;
  await import("@/auth");
  if (!h.authConfig) throw new Error("NextAuth config was not captured");
  return h.authConfig;
}

async function loadStartAction() {
  return (await import("@/app/demo/actions")).startPublicDemoAction;
}

type ElementWithProps = ReactElement<{
  action?: () => Promise<unknown>;
  children?: ReactNode;
}>;

function findElement(
  node: ReactNode,
  predicate: (element: ElementWithProps) => boolean,
): ElementWithProps | null {
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) return null;
  const element = node as ElementWithProps;
  if (predicate(element)) return element;
  const children = element.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}

async function renderLoginGate(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ElementWithProps> {
  const { default: LoginPage } = await import("@/app/login/page");
  const page = LoginPage({ searchParams: Promise.resolve(searchParams) }) as ElementWithProps;
  const gate = page.props.children as ElementWithProps;
  return (await (gate.type as (props: unknown) => Promise<ElementWithProps>)(
    gate.props,
  )) as ElementWithProps;
}

async function getGoogleFormAction(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<() => Promise<unknown>> {
  const loginContent = await renderLoginGate(searchParams);
  const content = await (loginContent.type as (props: unknown) => Promise<ElementWithProps>)(
    loginContent.props,
  );
  const googleForm = findElement(
    content,
    (element) =>
      element.type === "form" &&
      typeof element.props.action === "function" &&
      findElement(
        element.props.children,
        (child) =>
          child.props.children === "googleButton" ||
          (Array.isArray(child.props.children) && child.props.children.includes("googleButton")),
      ) !== null,
  );
  if (!googleForm?.props.action) throw new Error("Google sign-in form was not rendered");
  return googleForm.props.action;
}

describe("public Demo credentials provider", () => {
  beforeEach(() => {
    vi.resetModules();
    h.publicDemoEnabled = true;
    h.authenticateDemoTicket.mockReset();
  });

  it("registers public-demo separately from Internal Test Login", async () => {
    const config = await loadAuthConfig();

    expect(config.providers.map(({ id }) => id)).toEqual(["credentials", "public-demo"]);
    expect(config.providers.find(({ id }) => id === "public-demo")?.name).toBe("Public Demo");
  });

  it("returns the low-privilege user authenticated by a bound valid ticket", async () => {
    const demoUser = {
      id: "demo-user",
      name: "Demo visitor",
      email: null,
      image: null,
      isDemo: true,
      demoExpiresAt: "2026-08-02T00:00:00.000Z",
    };
    h.authenticateDemoTicket.mockResolvedValue(demoUser);
    const config = await loadAuthConfig();
    const provider = config.providers.find(({ id }) => id === "public-demo");

    await expect(
      provider?.authorize?.({ ticket: "valid-ticket", visitorToken: "matching-visitor" }),
    ).resolves.toEqual(demoUser);
    expect(h.authenticateDemoTicket).toHaveBeenCalledWith({
      ticket: "valid-ticket",
      visitorToken: "matching-visitor",
      now: expect.any(Date),
    });
  });

  it.each([
    ["tampered ticket", { ticket: "tampered", visitorToken: "matching-visitor" }],
    ["mismatched visitor token", { ticket: "valid-ticket", visitorToken: "wrong-visitor" }],
    ["expired workspace", { ticket: "expired-workspace", visitorToken: "matching-visitor" }],
  ])("rejects a %s rejected by authoritative Demo authentication", async (_label, credentials) => {
    h.authenticateDemoTicket.mockResolvedValue(null);
    const config = await loadAuthConfig();
    const provider = config.providers.find(({ id }) => id === "public-demo");

    await expect(provider?.authorize?.(credentials)).resolves.toBeNull();
  });

  it("rejects malformed credentials without attempting authentication", async () => {
    const config = await loadAuthConfig();
    const provider = config.providers.find(({ id }) => id === "public-demo");

    await expect(
      provider?.authorize?.({ ticket: 123, visitorToken: "visitor" }),
    ).resolves.toBeNull();
    await expect(
      provider?.authorize?.({ ticket: "ticket", visitorToken: null }),
    ).resolves.toBeNull();
    expect(h.authenticateDemoTicket).not.toHaveBeenCalled();
  });

  it("does not register public-demo while the kill switch is off", async () => {
    h.publicDemoEnabled = false;

    const config = await loadAuthConfig();

    expect(config.providers.map(({ id }) => id)).toEqual(["credentials"]);
  });
});

describe("startPublicDemoAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    h.publicDemoEnabled = true;
    h.signIn.mockReset().mockResolvedValue(undefined);
    h.signOut.mockReset().mockResolvedValue(undefined);
    h.getAuthContext.mockReset().mockResolvedValue({ status: "anonymous" });
    h.requestHeaders = new Headers({ "x-forwarded-for": "198.51.100.9, 203.0.113.7" });
    h.cookieGet.mockReset().mockReturnValue(undefined);
    h.cookieSet.mockReset();
    h.redirect.mockClear();
    h.rateLimitCheckWithPrune.mockReset().mockReturnValue(null);
    h.rateLimitKeyForClientIp.mockClear();
    h.getClientIpFromHeaders.mockClear();
    h.ensureDemoWorkspace.mockReset().mockResolvedValue({
      userId: "demo-user",
      visitorHash: "visitor-hash",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
      resumed: false,
    });
    h.createDemoLoginTicket.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a 256-bit visitor identity, sets the workspace-bounded cookie, and signs in server-side", async () => {
    const startPublicDemoAction = await loadStartAction();

    await expect(startPublicDemoAction({ errorCode: null }, new FormData())).resolves.toEqual({
      errorCode: null,
    });

    const visitorToken = h.ensureDemoWorkspace.mock.calls[0]?.[0].visitorToken as string;
    expect(Buffer.from(visitorToken, "base64url")).toHaveLength(32);
    expect(h.ensureDemoWorkspace).toHaveBeenCalledWith({
      visitorToken,
      clientIp: "203.0.113.7",
      locale: "en-US",
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(h.cookieSet).toHaveBeenCalledWith(
      "asset-tracker-demo-visitor",
      visitorToken,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date("2026-08-02T00:00:00.000Z"),
      }),
    );
    expect(h.createDemoLoginTicket).toHaveBeenCalledWith(
      {
        version: 1,
        userId: "demo-user",
        visitorHash: "visitor-hash",
        expiresAt: new Date("2026-08-01T00:01:00.000Z").getTime(),
      },
      "task-7-unit-secret",
    );
    expect(h.signIn).toHaveBeenCalledWith("public-demo", {
      ticket: "signed-demo-ticket",
      visitorToken,
      redirectTo: "/",
    });
  });

  it("resumes with the existing visitor identity without extending the workspace expiry", async () => {
    const visitorToken = "A".repeat(43);
    const expiresAt = new Date("2026-08-01T12:00:00.000Z");
    h.cookieGet.mockImplementation((name: string) =>
      name === "asset-tracker-demo-visitor" ? { value: visitorToken } : undefined,
    );
    h.ensureDemoWorkspace.mockResolvedValue({
      userId: "demo-user",
      visitorHash: "visitor-hash",
      expiresAt,
      resumed: true,
    });
    const startPublicDemoAction = await loadStartAction();

    await startPublicDemoAction({ errorCode: null }, new FormData());

    expect(h.ensureDemoWorkspace).toHaveBeenCalledWith(expect.objectContaining({ visitorToken }));
    expect(h.cookieSet).toHaveBeenCalledWith(
      "asset-tracker-demo-visitor",
      visitorToken,
      expect.objectContaining({ expires: expiresAt }),
    );
  });

  it("uses the persisted locale only for the supported Chinese fixture", async () => {
    h.cookieGet.mockImplementation((name: string) =>
      name === "NEXT_LOCALE" ? { value: "zh-TW" } : undefined,
    );
    const startPublicDemoAction = await loadStartAction();

    await startPublicDemoAction({ errorCode: null }, new FormData());

    expect(h.ensureDemoWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-TW" }),
    );
  });

  it.each(["formal", "demo"])(
    "redirects an already-active %s principal before guard or database work",
    async (kind) => {
      h.getAuthContext.mockResolvedValue({
        status: "active",
        session: { user: { id: `${kind}-user` } },
        principal: { kind, userId: `${kind}-user` },
      });
      const startPublicDemoAction = await loadStartAction();

      await expect(startPublicDemoAction({ errorCode: null }, new FormData())).rejects.toThrow(
        "NEXT_REDIRECT:/",
      );
      expect(h.rateLimitCheckWithPrune).not.toHaveBeenCalled();
      expect(h.ensureDemoWorkspace).not.toHaveBeenCalled();
    },
  );

  it("returns a stable rate-limit state before cookie or database work", async () => {
    h.rateLimitCheckWithPrune.mockReturnValue(
      new Response(null, { status: 429, headers: { "Retry-After": "17" } }),
    );
    const startPublicDemoAction = await loadStartAction();

    await expect(startPublicDemoAction({ errorCode: null }, new FormData())).resolves.toEqual({
      errorCode: "DEMO_RATE_LIMITED",
      retryAfterSeconds: 17,
    });
    expect(h.cookieGet).not.toHaveBeenCalled();
    expect(h.ensureDemoWorkspace).not.toHaveBeenCalled();
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it("keys Demo-start limiting with an opaque token rather than the forwarded IP", async () => {
    h.requestHeaders = new Headers({ "x-forwarded-for": "DEMO_START_IP_SENTINEL" });
    const startPublicDemoAction = await loadStartAction();

    await startPublicDemoAction({ errorCode: null }, new FormData());

    expect(h.rateLimitKeyForClientIp).toHaveBeenCalledWith(
      expect.any(Request),
      "public-demo-start",
    );
    expect(h.rateLimitCheckWithPrune).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        prefix: "public-demo-start",
        key: "hmac:public-demo-start",
      }),
    );
    expect(JSON.stringify(h.rateLimitCheckWithPrune.mock.calls)).not.toContain(
      "DEMO_START_IP_SENTINEL",
    );
  });

  it("returns stable service errors without exposing the ticket or visitor identity", async () => {
    const { PublicDemoError } = await import("@/lib/demo/demo-errors");
    h.ensureDemoWorkspace.mockRejectedValue(
      new PublicDemoError("DEMO_AT_CAPACITY", 503, "capacity", 29),
    );
    const startPublicDemoAction = await loadStartAction();

    await expect(startPublicDemoAction({ errorCode: null }, new FormData())).resolves.toEqual({
      errorCode: "DEMO_AT_CAPACITY",
      retryAfterSeconds: 29,
    });
    expect(h.cookieSet).not.toHaveBeenCalled();
    expect(h.createDemoLoginTicket).not.toHaveBeenCalled();
    expect(h.signIn).not.toHaveBeenCalled();
  });
});

describe("safe formal sign-in handoff from Demo", () => {
  beforeEach(() => {
    vi.resetModules();
    h.signIn.mockReset().mockResolvedValue(undefined);
    h.signOut.mockReset().mockResolvedValue(undefined);
    h.redirect.mockClear();
    h.getAuthContext.mockReset().mockResolvedValue({
      status: "active",
      session: { user: { id: "demo-user", isDemo: true, demoExpiresAt: null } },
      principal: {
        kind: "demo",
        userId: "demo-user",
        expiresAt: new Date("2026-08-02T00:00:00.000Z"),
      },
    });
  });

  it("completes Demo sign-out before a later request may initiate Google OAuth", async () => {
    const googleAction = await getGoogleFormAction({ from: "demo" });
    await googleAction();

    expect(h.getAuthContext).toHaveBeenCalledTimes(2);
    expect(h.signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", { status: "demo-expired", userId: "expired-demo" }],
    ["disabled", { status: "demo-disabled", userId: "disabled-demo" }],
    ["missing-authoritative-user", { status: "missing", sessionKind: "demo" as const }],
  ])("completes %s Demo-origin sign-out before Google OAuth", async (_label, authContext) => {
    h.getAuthContext.mockResolvedValue(authContext);

    const googleAction = await getGoogleFormAction({ from: "demo" });
    await googleAction();

    expect(h.signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ["anonymous", { status: "anonymous" }],
    ["missing formal", { status: "missing", sessionKind: "formal" as const }],
  ])("preserves Google sign-in for an %s context", async (_label, authContext) => {
    h.getAuthContext.mockResolvedValue(authContext);

    const googleAction = await getGoogleFormAction({});
    await googleAction();

    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.signIn).toHaveBeenCalledWith("google", { redirectTo: "/" });
  });

  it("preserves Google sign-in when a previously rendered action observes a formal principal", async () => {
    h.getAuthContext.mockResolvedValueOnce({ status: "anonymous" }).mockResolvedValueOnce({
      status: "active",
      session: { user: { id: "formal-user", isDemo: false, demoExpiresAt: null } },
      principal: { kind: "formal", userId: "formal-user" },
    });

    const googleAction = await getGoogleFormAction({});
    await googleAction();

    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.signIn).toHaveBeenCalledWith("google", { redirectTo: "/" });
  });

  it.each([
    ["another source", { from: "x" }],
    ["a one-value array", { from: ["demo"] }],
    ["duplicate values", { from: ["demo", "demo"] }],
    ["a stale-session combination", { from: "x", "stale-session": "1" }],
  ])("rejects %s instead of exposing formal controls to an active Demo", async (_label, params) => {
    await expect(renderLoginGate(params)).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("accepts only the scalar from=demo handoff for an active Demo", async () => {
    await expect(renderLoginGate({ from: "demo" })).resolves.toBeDefined();
  });
});

describe("public Demo login localization", () => {
  it.each(["messages/en-US.json", "messages/zh-TW.json"])(
    "defines every stable action error in %s",
    (path) => {
      const messages = JSON.parse(readFileSync(path, "utf8")) as {
        demo?: { login?: { errors?: Record<string, string> } };
      };

      expect(Object.keys(messages.demo?.login?.errors ?? {}).sort()).toEqual(
        [...DEMO_ERROR_CODES].sort(),
      );
      expect(Object.values(messages.demo?.login?.errors ?? {}).every(Boolean)).toBe(true);
    },
  );
});
