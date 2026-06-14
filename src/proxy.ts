import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { AUTH_SOURCE_HEADER, AUTH_SOURCE_PROXY, AUTH_USER_ID_HEADER } from "@/lib/auth-headers";
import { SESSION_COOKIE_NAMES } from "@/lib/auth-cookies";
import { getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login", "/privacy", "/terms"];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

function requestHeadersForApp(req: NextRequest, userId?: string): Headers {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(AUTH_USER_ID_HEADER);
  requestHeaders.delete(AUTH_SOURCE_HEADER);

  if (userId) {
    requestHeaders.set(AUTH_USER_ID_HEADER, userId);
    requestHeaders.set(AUTH_SOURCE_HEADER, AUTH_SOURCE_PROXY);
  }

  return requestHeaders;
}

function nextResponse(req: NextRequest, userId?: string): NextResponse {
  const response = NextResponse.next({
    request: {
      headers: requestHeadersForApp(req, userId),
    },
  });
  setLocaleCookie(req, response);
  return response;
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

function _authRateLimit(request: Request): Response | null {
  const ip = getClientIp(request);
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 20;
  const entry = _authRLStore.get(ip);

  if (!entry || now >= entry.resetAt) {
    _authRLStore.set(ip, { count: 1, resetAt: now + windowMs });
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

  if (!isLoggedIn && !isPublicRoute) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  const isStaleSessionRecovery = req.nextUrl.searchParams.has("stale-session");

  if (isLoggedIn && req.nextUrl.pathname === "/login" && !isStaleSessionRecovery) {
    const newUrl = new URL("/", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  return nextResponse(req, req.auth?.user?.id);
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Rate-limit auth callbacks before any NextAuth processing.
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    const limited = _authRateLimit(req);
    if (limited) return limited;
    return;
  }

  // P4 fast path: no session cookie means the request is anonymous — decide
  // redirect vs. pass-through from the cookie header alone, without invoking
  // NextAuth's JWT decode. Bot traffic that survives the matcher lands here.
  if (!hasSessionCookie(req)) {
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

// Negative-lookahead exclusions:
//   - Next/Vercel internals + cron + file-based metadata (already excluded before P1).
//   - robots.txt / sitemap.xml served from `public/`.
//   - PWA assets sw.js + manifest.webmanifest: the browser fetches these without
//     credentials, so they must resolve to 200 (not a /login redirect) or Chrome's
//     installability check fails and the install prompt never appears.
//   - Public login/legal pages, so they can render without NextAuth cookie work.
//     The signed-in /login redirect lives in the login page itself.
//   - Common bot/scanner probes observed in production logs and in the wild:
//     wp-admin/wp-login/wp-content/wp-includes/wordpress, xmlrpc, cgi-bin,
//     phpmyadmin/adminer, cmd_*, vendor/phpunit, plus any path containing
//     .php/.asp/.aspx/.jsp/.cgi/.env/.git/.svn/.htaccess/.htpasswd.
// Bot tokens are anchored at position 1 (no leading `.*`) so we don't
// accidentally skip legitimate routes that happen to contain these
// substrings deeper in the path; extension/dotfile tokens use `.*` so any
// component carrying them is excluded.
export const config = {
  matcher: [
    "/((?!api/(?!auth)|_next/static|_next/image|_vercel|favicon\\.ico|sw\\.js|manifest\\.webmanifest|apple-icon|icon|opengraph-image|twitter-image|robots\\.txt|sitemap\\.xml|login|privacy|terms|wp-admin|wp-login|wp-content|wp-includes|wordpress|xmlrpc|cgi-bin|cmd_|phpmyadmin|adminer|vendor/phpunit|.*\\.php|.*\\.aspx?|.*\\.jsp|.*\\.cgi|.*\\.env|.*\\.git|.*\\.svn|.*\\.htaccess|.*\\.htpasswd).*)",
  ],
};
