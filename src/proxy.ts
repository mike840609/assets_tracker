import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

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
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : "unknown";
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

export default auth((req) => {
  // Rate-limit auth callbacks before any NextAuth processing.
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    const limited = _authRateLimit(req);
    if (limited) return limited;
    return;
  }

  const isLoggedIn = !!req.auth;
  const isPublicRoute = ["/login", "/privacy", "/terms"].includes(req.nextUrl.pathname);

  if (!isLoggedIn && !isPublicRoute) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  if (isLoggedIn && req.nextUrl.pathname === "/login") {
    const newUrl = new URL("/", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  // On first visit (no locale cookie), detect from Accept-Language and set cookie
  const localeCookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (!localeCookie) {
    const acceptLanguage = req.headers.get("accept-language") ?? "";
    const locale = acceptLanguage.toLowerCase().includes("zh") ? "zh-TW" : "en-US";
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }
});

// Negative-lookahead exclusions:
//   - Next internals + cron + file-based metadata (already excluded before P1).
//   - robots.txt / sitemap.xml served from `public/`.
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
    "/((?!api/(?!auth)|_next/static|_next/image|favicon\\.ico|apple-icon|icon|opengraph-image|twitter-image|robots\\.txt|sitemap\\.xml|wp-admin|wp-login|wp-content|wp-includes|wordpress|xmlrpc|cgi-bin|cmd_|phpmyadmin|adminer|vendor/phpunit|.*\\.php|.*\\.aspx?|.*\\.jsp|.*\\.cgi|.*\\.env|.*\\.git|.*\\.svn|.*\\.htaccess|.*\\.htpasswd).*)",
  ],
};
