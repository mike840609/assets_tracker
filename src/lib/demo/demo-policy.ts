export const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const DEMO_TICKET_TTL_MS = 60 * 1000;
export const DEMO_SOURCE_LIMIT = 5;
export const DEMO_GLOBAL_LIMIT = 250;
export const DEMO_MUTATION_WINDOW_MS = 60 * 1000;
export const DEMO_MUTATION_WINDOW_LIMIT = 30;
export const DEMO_MUTATION_LIFETIME_LIMIT = 250;
export const DEMO_RESET_LIMIT = 3;
export const DEMO_REFRESH_WINDOW_MS = 10 * 60 * 1000;
export const DEMO_REFRESH_LIMIT = 3;
export const DEMO_CLEANUP_BATCH_SIZE = 25;
export const DEMO_CLEANUP_MAX_USERS = 250;
export const DEMO_CLEANUP_BUDGET_MS = 5_000;
export const DEMO_VISITOR_COOKIE = "asset-tracker-demo-visitor";
export const DEMO_CAPACITY_LOCK_KEY = 1_095_976_020;

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const VISITOR_TOKEN_PATTERN = /^(?:[A-Fa-f0-9]{64}|[A-Za-z0-9_-]{43})$/;

export function resolvePublicDemoEnabled(value: string | undefined): boolean {
  return TRUE_VALUES.has(value?.trim().toLowerCase() ?? "");
}

export function isValidDemoVisitorToken(value: string | undefined): value is string {
  return value !== undefined && VISITOR_TOKEN_PATTERN.test(value);
}

export function demoVisitorCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
