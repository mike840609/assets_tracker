type ApiErrorBody = {
  error?: {
    message?: string;
    issues?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
  };
};

/**
 * The message to show for a failed API response. 401 gets the caller's
 * translated "session expired" text instead of the raw "Unauthorized"; a
 * validation failure shows its first specific reason; anything else uses the
 * server's message, or `fallback` when there is none.
 * ponytail: server reasons are English (zod messages); translate them only if
 * that ever matters.
 */
export async function apiErrorMessage(
  res: Response,
  { fallback, sessionExpired }: { fallback: string; sessionExpired: string },
): Promise<string> {
  if (res.status === 401) return sessionExpired;
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const error = body?.error;
  const issue =
    error?.issues?.formErrors?.[0] ??
    Object.values(error?.issues?.fieldErrors ?? {}).find((list) => list?.length)?.[0];
  if (issue) return issue;
  if (error?.message && error.message !== "Validation failed") return error.message;
  return fallback;
}

/** Thrown for a non-OK API response; its message is safe to show the user. */
export class ApiError extends Error {}

/** Throws an ApiError carrying the user-facing reason when `res` is not OK. */
export async function assertOk(res: Response, sessionExpired: string): Promise<void> {
  if (!res.ok) throw new ApiError(await apiErrorMessage(res, { fallback: "", sessionExpired }));
}

/**
 * Toast text for a caught error: an ApiError's reason, else `fallback`. A network
 * failure (`TypeError: Failed to fetch`) is never shown raw.
 */
export function errorText(error: unknown, fallback: string): string {
  return (error instanceof ApiError && error.message) || fallback;
}
