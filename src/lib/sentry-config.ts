import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const REDACTED = "[Filtered]";

const SENSITIVE_KEY_PATTERN =
  /cookie|authorization|token|secret|password|email|username|name|image|avatar|providerAccountId|session|oauth|balance|amount|quantity|price|netWorth|totalAssets|totalLiabilities|breakdown|payload|body|data/i;

const HIGH_NOISE_WARNING_MESSAGES = new Set([
  "csp.violation",
  "csp.report.invalid",
  "cwv.budget_exceeded",
  "prisma.slow_query",
  "option.multiplier.defaulted",
  "rates.unresolved",
]);

type SentryRuntime = "nodejs" | "edge" | "browser";

export function getSentryEnvironment(): string {
  return process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
}

export function getSentryRelease(): string | undefined {
  return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;
}

export function getSentryDist(): string | undefined {
  return getSentryRelease()?.slice(0, 12);
}

export function getSentryTags(runtime: SentryRuntime): Record<string, string> {
  return {
    runtime,
    app: "asset-tracker",
  };
}

export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.level === "warning" && HIGH_NOISE_WARNING_MESSAGES.has(getEventMessage(event))) {
    return null;
  }

  sanitizeEvent(event);
  return event;
}

function getEventMessage(event: ErrorEvent): string {
  return event.message ?? event.logentry?.message ?? getStringValue(event.extra?.msg) ?? "";
}

function sanitizeEvent(event: ErrorEvent): void {
  if (event.user) {
    const id = event.user.id;
    event.user = id === undefined ? {} : { id: hashIdentifier(String(id)) };
  }

  if (event.request) {
    event.request.url = sanitizeUrl(event.request.url);
    event.request.query_string = REDACTED;
    event.request.cookies = undefined;
    event.request.data = REDACTED;
    event.request.headers = sanitizeRecord(event.request.headers);
  }

  event.extra = sanitizeUnknown(event.extra) as ErrorEvent["extra"];
  event.contexts = sanitizeUnknown(event.contexts) as ErrorEvent["contexts"];
  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    ...breadcrumb,
    data: sanitizeUnknown(breadcrumb.data) as typeof breadcrumb.data,
  }));
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 5) return "[Truncated]";
  if (value instanceof Error) return value.message;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item, depth + 1));
  if (typeof value !== "object") return value;

  const clean: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === "userId") {
      clean.user_hash = hashIdentifier(String(nested));
      continue;
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = REDACTED;
      continue;
    }
    clean[key] =
      typeof nested === "string" ? sanitizeString(key, nested) : sanitizeUnknown(nested, depth + 1);
  }
  return clean;
}

function sanitizeRecord(
  record: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!record) return undefined;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    clean[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeString(key, value);
  }
  return clean;
}

function sanitizeString(key: string, value: string): string {
  if (/url|uri/i.test(key)) return sanitizeUrl(value) ?? REDACTED;
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  return value;
}

function sanitizeUrl(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    const url = new URL(value, "https://asset-tracker.local");
    url.search = "";
    url.hash = "";
    return value.startsWith("/") ? url.pathname : url.toString();
  } catch {
    return value.split("?")[0]?.split("#")[0] ?? value;
  }
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function hashIdentifier(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `hash:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
