import { withStreamedSpan } from "@sentry/nextjs";
import type { ErrorEvent, EventHint, init as sentryInit } from "@sentry/nextjs";

const REDACTED = "[Filtered]";

const SENSITIVE_KEY_PATTERN =
  /cookie|authorization|token|secret|password|email|username|name|image|avatar|providerAccountId|session|oauth|balance|amount|quantity|price|netWorth|totalAssets|totalLiabilities|breakdown|payload|body|data|forwarded|clientIp|connectingIp|realIp|remoteAddr|ip(?:Address)?$/i;
const ERROR_TEXT_KEY_PATTERN = /message|msg|error|exception|stack|trace|reason|detail/i;
const IDENTIFIER_KEY_PATTERN = /(?:id|identifier)$/i;
const FORWARDING_HEADER_PATTERN =
  /^(?:forwarded|x-forwarded-for|cf-connecting-ip|x-real-ip|true-client-ip|x-client-ip|fastly-client-ip)$/i;
const IP_LITERAL_PATTERN = /(?:\b(?:\d{1,3}\.){3}\d{1,3}\b)|(?:(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]+)/i;
const DYNAMIC_ROUTE_SEGMENTS = new Set([
  "account",
  "accounts",
  "cash-transactions",
  "calendar-entries",
  "demo",
  "demos",
  "goal",
  "goals",
  "holding",
  "holdings",
  "recurring-cash-transactions",
  "recurring-investments",
  "snapshot",
  "snapshots",
  "stock",
  "stocks",
  "transaction",
  "transactions",
  "workspace",
  "workspaces",
]);
const STATIC_ROUTE_SEGMENTS = new Set([
  "archived",
  "cash-transactions",
  "expired",
  "holdings",
  "new",
  "quote",
  "recurring-cash-transactions",
  "recurring-investments",
  "refresh",
  "reorder",
]);

const HIGH_NOISE_WARNING_MESSAGES = new Set([
  "csp.violation",
  "csp.report.invalid",
  "cwv.budget_exceeded",
  "prisma.slow_query",
  "option.multiplier.defaulted",
  "rates.unresolved",
]);

type SentryOptions = Parameters<typeof sentryInit>[0];
type TransactionEvent = Parameters<NonNullable<SentryOptions["beforeSendTransaction"]>>[0];
type SpanJSON = Parameters<NonNullable<SentryOptions["beforeSendSpan"]>>[0];
type SanitizableEvent = ErrorEvent | TransactionEvent;

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

/** Apply the same privacy boundary to trace transactions as error events. */
export function beforeSendTransaction(
  event: TransactionEvent,
  _hint: EventHint,
): TransactionEvent | null {
  sanitizeEvent(event);
  return event;
}

/**
 * Sentry invokes this hook for standalone spans, which do not pass through a
 * transaction event in streamed and Edge transports.
 */
export const beforeSendSpan = withStreamedSpan((span) => {
  sanitizeSpan(span);
  return span;
});

function getEventMessage(event: ErrorEvent): string {
  return event.message ?? event.logentry?.message ?? getStringValue(event.extra?.msg) ?? "";
}

function sanitizeEvent(event: SanitizableEvent): void {
  event.message = redactMessage(event.message);
  if (event.logentry) {
    const logentry = event.logentry as typeof event.logentry & { formatted?: string };
    const sanitizedLogentry = {
      ...logentry,
      formatted: redactMessage(logentry.formatted),
      message: redactMessage(logentry.message),
      params: logentry.params?.map(() => REDACTED),
    };
    event.logentry = sanitizedLogentry as ErrorEvent["logentry"];
  }
  if (event.exception?.values) {
    event.exception = {
      ...event.exception,
      values: event.exception.values.map((exception) => ({
        ...exception,
        value: redactMessage(exception.value),
        mechanism: exception.mechanism
          ? {
              ...exception.mechanism,
              data: sanitizeUnknown(exception.mechanism.data) as typeof exception.mechanism.data,
            }
          : undefined,
        // Stack frames can contain request paths and provider URLs. The event
        // still retains the exception type and Sentry's grouping metadata.
        stacktrace: undefined,
      })),
    };
  }

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
    event.request.env = sanitizeRecord(event.request.env);
  }

  event.extra = sanitizeUnknown(event.extra) as ErrorEvent["extra"];
  event.contexts = sanitizeUnknown(event.contexts) as ErrorEvent["contexts"];
  event.tags = sanitizeRecord(event.tags);
  event.transaction = redactMessage(event.transaction);
  event.fingerprint = event.fingerprint?.map(() => REDACTED);
  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    ...breadcrumb,
    category: redactMessage(breadcrumb.category),
    message: redactMessage(breadcrumb.message),
    data: sanitizeUnknown(breadcrumb.data) as typeof breadcrumb.data,
  }));
  event.spans = event.spans?.map(sanitizeStaticSpan);
}

function sanitizeStaticSpan(span: SpanJSON): SpanJSON {
  sanitizeSpan(span);
  return span;
}

function sanitizeSpan(span: {
  attributes?: unknown;
  data?: unknown;
  description?: string;
  name?: string;
}): void {
  if (span.description !== undefined) {
    span.description = redactMessage(span.description);
  }
  if (span.name !== undefined) {
    span.name = redactMessage(span.name);
  }
  if (span.data !== undefined) {
    span.data = sanitizeUnknown(span.data);
  }
  if (span.attributes !== undefined) {
    span.attributes = sanitizeUnknown(span.attributes);
  }
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 5) return "[Truncated]";
  if (value instanceof Error) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item, depth + 1));
  if (typeof value === "string") return sanitizeString("", value);
  if (typeof value !== "object") return value;

  const clean: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORWARDING_HEADER_PATTERN.test(key)) continue;
    if (IDENTIFIER_KEY_PATTERN.test(key)) {
      clean[identifierHashKey(key)] = hashIdentifier(String(nested));
      continue;
    }
    if (SENSITIVE_KEY_PATTERN.test(key) || ERROR_TEXT_KEY_PATTERN.test(key)) {
      clean[key] = REDACTED;
      continue;
    }
    clean[key] =
      typeof nested === "string" ? sanitizeString(key, nested) : sanitizeUnknown(nested, depth + 1);
  }
  return clean;
}

function sanitizeRecord(
  record: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!record) return undefined;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (FORWARDING_HEADER_PATTERN.test(key)) continue;
    if (IDENTIFIER_KEY_PATTERN.test(key)) {
      clean[identifierHashKey(key)] = hashIdentifier(String(value));
      continue;
    }
    clean[key] =
      SENSITIVE_KEY_PATTERN.test(key) || typeof value !== "string"
        ? REDACTED
        : sanitizeString(key, value);
  }
  return clean;
}

function redactMessage(value: string | undefined): string | undefined {
  return value === undefined ? undefined : REDACTED;
}

function sanitizeString(key: string, value: string): string {
  if (ERROR_TEXT_KEY_PATTERN.test(key)) return REDACTED;
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (IP_LITERAL_PATTERN.test(value)) return REDACTED;
  if (/url|uri|path|route|transaction/i.test(key) || /^(?:https?:\/\/|\/)/i.test(value)) {
    return sanitizeUrl(value) ?? REDACTED;
  }
  return value;
}

function sanitizeUrl(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    const url = new URL(value, "https://asset-tracker.local");
    url.search = "";
    url.hash = "";
    url.pathname = sanitizePathname(url.pathname);
    return value.startsWith("/") ? url.pathname : url.toString();
  } catch {
    return sanitizePathname(value.split("?")[0]?.split("#")[0] ?? value);
  }
}

function sanitizePathname(pathname: string): string {
  const segments = pathname.split("/");
  return segments
    .map((segment, index) => {
      const previous = segments[index - 1]?.toLowerCase();
      if (
        previous &&
        DYNAMIC_ROUTE_SEGMENTS.has(previous) &&
        segment &&
        !STATIC_ROUTE_SEGMENTS.has(segment.toLowerCase())
      ) {
        return ":id";
      }
      return segment;
    })
    .join("/");
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function identifierHashKey(key: string): string {
  const stem = key.replace(IDENTIFIER_KEY_PATTERN, "").replace(/[_-]+$/, "");
  return `${stem || "identifier"}_hash`;
}

function hashIdentifier(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `hash:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
