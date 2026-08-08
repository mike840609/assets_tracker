import { failure } from "@/lib/api-responses";

export const DEMO_ERROR_CODES = [
  "DEMO_RESTRICTED",
  "DEMO_QUOTA_EXHAUSTED",
  "DEMO_EXPIRED",
  "DEMO_RATE_LIMITED",
  "DEMO_SOURCE_LIMIT",
  "DEMO_AT_CAPACITY",
  "DEMO_DISABLED",
  "DEMO_INITIALIZATION_FAILED",
  "DEMO_RESET_FAILED",
] as const;

export type DemoErrorCode = (typeof DEMO_ERROR_CODES)[number];

export class PublicDemoError extends Error {
  constructor(
    readonly code: DemoErrorCode,
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PublicDemoError";
  }
}

export function demoErrorResponse(error: PublicDemoError): Response {
  return failure(error.message, error.status, {
    code: error.code,
    headers:
      error.retryAfterSeconds === undefined
        ? undefined
        : { "Retry-After": String(error.retryAfterSeconds) },
  });
}
