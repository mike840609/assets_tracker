import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { SESSION_COOKIE_NAMES } from "@/lib/auth-cookies";
import {
  DEMO_LIFETIME_MS,
  DEMO_VISITOR_COOKIE,
  isValidDemoVisitorToken,
} from "@/lib/demo/demo-policy";
import { AUTH_SECRET, isPublicDemoEnabled } from "@/lib/env";
import { getClientIp } from "@/lib/client-ip";
import { getMobileHubRedirectUrl } from "@/lib/mobile-hub-route";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const LANDING_PATH = "/landing";
const PUBLIC_ROUTES = ["/login", "/privacy", "/terms", "/demo/expired", LANDING_PATH];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

function nextResponse(req: NextRequest): NextResponse {
  const response = NextResponse.next();
  setLocaleCookie(req, response);
  if (
    isPublicDemoEnabled &&
    (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/demo/expired") &&
    !isValidDemoVisitorToken(req.cookies.get(DEMO_VISITOR_COOKIE)?.value)
  ) {
    response.cookies.set(DEMO_VISITOR_COOKIE, randomVisitorToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_LIFETIME_MS / 1000,
    });
  }
  return response;
}

/**
 * Anonymous "/" serves the public landing page. This is a rewrite, not a
 * redirect, so the shareable URL stays https://astt.app — directory listings
 * and search engines index the pitch instead of a sign-in form, and the
 * authenticated dashboard keeps the same path.
 */
function rewriteToLanding(req: NextRequest): NextResponse {
  const response = NextResponse.rewrite(new URL(LANDING_PATH, req.nextUrl.origin));
  setLocaleCookie(req, response);
  return response;
}

function randomVisitorToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function signedDemoIsUnavailable(
  user: { isDemo?: boolean; demoExpiresAt?: string | null } | undefined,
): boolean {
  if (user?.isDemo !== true) return false;
  const expiresAt = user.demoExpiresAt;
  const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  return !isPublicDemoEnabled || !Number.isFinite(expiryMs) || Date.now() >= expiryMs;
}

// Bot/scanner probes observed in production logs and in the wild. These used to
// be excluded in `matcher`, but the extension tokens there carried a leading
// `.*` and JS `.` matches `/`, so a probe token anywhere in the path skipped the
// middleware entirely — including on real dynamic routes like /accounts/x.env
// (#639). Filtering here keeps the check anchored to the first path segment, so
// it can never swallow a dynamic segment deeper in the path.
const BOT_PATH_PREFIXES = [
  "wp-admin",
  "wp-login",
  "wp-content",
  "wp-includes",
  "wordpress",
  "xmlrpc",
  "cgi-bin",
  "cmd_",
  "phpmyadmin",
  "adminer",
  "vendor/phpunit",
];

const BOT_FILE_TOKENS = [
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".cgi",
  ".env",
  ".git",
  ".svn",
  ".htaccess",
  ".htpasswd",
];

function isBotProbe(pathname: string): boolean {
  const path = pathname.replace(/^\/+/, "").toLowerCase();
  if (BOT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;

  const firstSegment = path.split("/", 1)[0];
  return BOT_FILE_TOKENS.some((token) => firstSegment.includes(token));
}

// ---------------------------------------------------------------------------
// R3 — Inline rate limiter for /api/auth/* (20 req/min per IP).
// Inlined here because Edge middleware runs in its own isolated module graph.
// ---------------------------------------------------------------------------
interface _RLEntry {
  count: number;
  resetAt: number;
}
const _authRLStore = new Map<string, _RLEntry>();
let _authRLLastPruned = 0;

function _authRLMaybePrune(now: number): void {
  if (now - _authRLLastPruned < 60_000) return;
  _authRLLastPruned = now;
  for (const [ip, entry] of _authRLStore) {
    if (now >= entry.resetAt) _authRLStore.delete(ip);
  }
}

async function _authRateLimitKey(request: Request): Promise<string> {
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(`asset-tracker/auth-rate-limit/v1\u0000${getClientIp(request)}`),
  );
  return Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function _authRateLimit(request: Request): Promise<Response | null> {
  const key = await _authRateLimitKey(request);
  const now = Date.now();
  _authRLMaybePrune(now);
  const windowMs = 60_000;
  const limit = 20;
  const entry = _authRLStore.get(key);

  if (!entry || now >= entry.resetAt) {
    _authRLStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  entry.count += 1;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(JSON.stringify({ error: { message: "Too many requests" } }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    });
  }
  return null;
}
// ---------------------------------------------------------------------------

// On first visit (no locale cookie), detect from Accept-Language and set cookie.
function setLocaleCookie(req: NextRequest, response: NextResponse): void {
  const localeCookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (localeCookie) return;

  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const locale = acceptLanguage.toLowerCase().includes("zh") ? "zh-TW" : "en-US";
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

// Slow path: a session cookie is present, so pay the JWT decode to validate it.
const authMiddleware = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublicRoute = PUBLIC_ROUTES.includes(req.nextUrl.pathname);
  const isStaleSessionRecovery = req.nextUrl.searchParams.has("stale-session");
  const fromValues = req.nextUrl.searchParams.getAll("from");
  const isDemoFormalLoginHandoff =
    req.auth?.user?.isDemo === true && fromValues.length === 1 && fromValues[0] === "demo";
  const isDemoUnavailable = signedDemoIsUnavailable(req.auth?.user);

  if (
    isDemoUnavailable &&
    req.nextUrl.pathname !== "/demo/expired" &&
    !(req.nextUrl.pathname === "/login" && (isDemoFormalLoginHandoff || isStaleSessionRecovery))
  ) {
    return Response.redirect(new URL("/demo/expired", req.nextUrl.origin));
  }

  if (!isLoggedIn && !isPublicRoute) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  if (
    isLoggedIn &&
    req.nextUrl.pathname === "/login" &&
    !isDemoUnavailable &&
    !isDemoFormalLoginHandoff &&
    !isStaleSessionRecovery
  ) {
    const newUrl = new URL("/", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  const mobileHubUrl = getMobileHubRedirectUrl({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    userAgent: req.headers.get("user-agent"),
  });
  if (isLoggedIn && mobileHubUrl) {
    return Response.redirect(new URL(mobileHubUrl, req.nextUrl.origin));
  }

  return nextResponse(req);
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const sentryTunnelPath = process.env._sentryRewritesTunnelPath;
  if (sentryTunnelPath && req.nextUrl.pathname === sentryTunnelPath) {
    return NextResponse.next();
  }

  // Rate-limit auth callbacks before any NextAuth processing.
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    return _authRateLimit(req).then((limited) => limited ?? undefined);
  }

  // Bot probes get routing's own 404 rather than a /login redirect, and never
  // pay for NextAuth work. This check lives here, not in `matcher`, so that
  // every app path is matched and no route can opt itself out of the middleware.
  if (isBotProbe(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // P4 fast path: no session cookie means the request is anonymous — decide
  // redirect vs. pass-through from the cookie header alone, without invoking
  // NextAuth's JWT decode.
  if (!hasSessionCookie(req)) {
    if (req.nextUrl.pathname === "/") {
      return rewriteToLanding(req);
    }
    if (!PUBLIC_ROUTES.includes(req.nextUrl.pathname)) {
      return Response.redirect(new URL("/login", req.nextUrl.origin));
    }
    return nextResponse(req);
  }

  // NextAuth types the wrapped handler for route-handler contexts too, so the
  // middleware NextFetchEvent needs a cast — it's what auth() receives when
  // exported as middleware directly.
  return authMiddleware(
    req as Parameters<typeof authMiddleware>[0],
    event as unknown as Parameters<typeof authMiddleware>[1],
  );
}

// Negative-lookahead exclusions. Every token here is a fixed, non-routable
// asset or public page anchored at position 1 — nothing uses a leading `.*`, so
// no exclusion can span path segments and quietly skip a routable app page:
//   - Next/Vercel internals + cron + file-based metadata (already excluded before P1).
//   - robots.txt / sitemap.xml served from `public/`.
//   - PWA assets sw.js + manifest.webmanifest: the browser fetches these without
//     credentials, so they must resolve to 200 (not a /login redirect) or Chrome's
//     installability check fails and the install prompt never appears.
//   - hero.jpg: the product screenshot on /login, which anonymous visitors must
//     be able to load or the public landing surface renders a broken image.
//   - Public legal pages, so they can render without NextAuth cookie work.
//     Login and Demo expiry stay matched to pre-seed the visitor cookie.
// Bot/scanner probes are NOT excluded here — they are filtered by `isBotProbe`
// inside `middleware()` above, so every app path reaches the middleware (#639).
export const config = {
  matcher: [
    "/((?!api/(?!auth)|_next/static|_next/image|_vercel|favicon\\.ico|sw\\.js|manifest\\.webmanifest|hero\\.jpg|apple-icon|icon|opengraph-image|twitter-image|robots\\.txt|sitemap\\.xml|privacy|terms).*)",
  ],
};
