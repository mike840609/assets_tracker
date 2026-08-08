"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { signIn, signOut } from "@/auth";
import { AUTH_SECRET } from "@/lib/env";
import {
  DEMO_TICKET_TTL_MS,
  DEMO_VISITOR_COOKIE,
  demoVisitorCookieOptions,
  isValidDemoVisitorToken,
} from "@/lib/demo/demo-policy";
import { createDemoLoginTicket } from "@/lib/demo/demo-crypto";
import { PublicDemoError, type DemoErrorCode } from "@/lib/demo/demo-errors";
import { ensureDemoWorkspace, resetDemoWorkspace } from "@/lib/demo/demo-service";
import { getAuthContext } from "@/lib/auth-session";
import {
  getClientIpFromHeaders,
  rateLimitCheckWithPrune,
  rateLimitKeyForClientIp,
} from "@/lib/rate-limit";

export type DemoActionState = {
  errorCode: DemoErrorCode | null;
  retryAfterSeconds?: number;
};

export type DemoResetActionState = DemoActionState & { completedResets: number };

export async function startPublicDemoAction(
  _previous: DemoActionState,
  _formData: FormData,
): Promise<DemoActionState> {
  const authContext = await getAuthContext();
  if (authContext.status === "active") redirect("/");
  const requestHeaders = new Headers(await headers());
  const syntheticRequest = new Request("https://asset-tracker.invalid/demo/start", {
    headers: requestHeaders,
  });
  const limited = rateLimitCheckWithPrune(syntheticRequest, {
    limit: 10,
    prefix: "public-demo-start",
    key: rateLimitKeyForClientIp(syntheticRequest, "public-demo-start"),
  });
  if (limited) {
    const retryAfter = limited.headers.get("Retry-After");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
    return {
      errorCode: "DEMO_RATE_LIMITED",
      ...(Number.isFinite(retryAfterSeconds) ? { retryAfterSeconds } : {}),
    };
  }

  const cookieStore = await cookies();
  const existingVisitorToken = cookieStore.get(DEMO_VISITOR_COOKIE)?.value;
  const visitorToken = isValidDemoVisitorToken(existingVisitorToken)
    ? existingVisitorToken
    : randomBytes(32).toString("base64url");
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh-TW" ? "zh-TW" : "en-US";
  const now = new Date();

  let workspace;
  try {
    workspace = await ensureDemoWorkspace({
      visitorToken,
      clientIp: getClientIpFromHeaders(requestHeaders),
      locale,
      now,
    });
  } catch (error) {
    if (error instanceof PublicDemoError) {
      return { errorCode: error.code, retryAfterSeconds: error.retryAfterSeconds };
    }
    return { errorCode: "DEMO_INITIALIZATION_FAILED" };
  }

  cookieStore.set(DEMO_VISITOR_COOKIE, visitorToken, demoVisitorCookieOptions(workspace.expiresAt));
  const ticketExpiresAt = Math.min(Date.now() + DEMO_TICKET_TTL_MS, workspace.expiresAt.getTime());
  const ticket = createDemoLoginTicket(
    {
      version: 1,
      userId: workspace.userId,
      visitorHash: workspace.visitorHash,
      expiresAt: ticketExpiresAt,
    },
    AUTH_SECRET,
  );
  await signIn("public-demo", { ticket, visitorToken, redirectTo: "/" });
  return { errorCode: null };
}

export async function exitPublicDemoAction() {
  await signOut({ redirectTo: "/login" });
}

export async function resetPublicDemoAction(
  previous: DemoResetActionState,
  _formData: FormData,
): Promise<DemoResetActionState> {
  const context = await getAuthContext();
  if (context.status === "demo-expired") {
    return { ...previous, errorCode: "DEMO_EXPIRED" };
  }
  if (context.status === "demo-disabled") {
    return { ...previous, errorCode: "DEMO_DISABLED" };
  }
  if (context.status !== "active" || context.principal.kind !== "demo") {
    return { ...previous, errorCode: "DEMO_RESTRICTED" };
  }

  const locale = (await cookies()).get("NEXT_LOCALE")?.value === "zh-TW" ? "zh-TW" : "en-US";
  try {
    await resetDemoWorkspace({
      userId: context.principal.userId,
      locale,
      now: new Date(),
    });
    for (const tag of [
      "accounts",
      "net-worth",
      "history",
      "goals",
      "calendar-entries",
      "settings",
      "stocks",
    ]) {
      revalidateTag(`${tag}:${context.principal.userId}`, { expire: 0 });
    }
    return {
      errorCode: null,
      completedResets: previous.completedResets + 1,
    };
  } catch (error) {
    return error instanceof PublicDemoError
      ? {
          ...previous,
          errorCode: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
        }
      : { ...previous, errorCode: "DEMO_RESET_FAILED" };
  }
}
