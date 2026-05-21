import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse, type NextRequest } from "next/server";
import { SUPPORTED_LOCALES, type Locale } from "./i18n/config";

const { auth } = NextAuth(authConfig);
const PUBLIC_ROUTES = new Set(["/login", "/privacy", "/terms"]);

function getCanonicalPathname(pathname: string): { pathname: string; locale?: Locale } {
  const locale = SUPPORTED_LOCALES.find(
    (candidate) => pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`),
  );

  if (!locale) return { pathname };

  return {
    locale,
    pathname: pathname === `/${locale}` ? "/" : pathname.slice(locale.length + 1),
  };
}

function setLocaleCookie(response: NextResponse, locale?: Locale) {
  if (!locale) return response;

  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}

function createRedirectUrl(req: NextRequest, pathname: string, preserveSearch = false) {
  const protocol = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = host ? `${protocol}://${host}` : req.nextUrl.origin;
  const url = new URL(pathname, origin);

  if (preserveSearch) url.search = req.nextUrl.search;

  return url;
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
  const canonicalPath = getCanonicalPathname(req.nextUrl.pathname);
  const isPublicRoute = PUBLIC_ROUTES.has(canonicalPath.pathname);

  if (canonicalPath.locale && isPublicRoute) {
    const newUrl = createRedirectUrl(req, canonicalPath.pathname, true);
    return setLocaleCookie(NextResponse.redirect(newUrl), canonicalPath.locale);
  }

  if (!isLoggedIn && !isPublicRoute) {
    const newUrl = createRedirectUrl(req, "/login");
    return setLocaleCookie(NextResponse.redirect(newUrl), canonicalPath.locale);
  }

  if (isLoggedIn && canonicalPath.pathname === "/login") {
    const newUrl = createRedirectUrl(req, "/");
    return setLocaleCookie(NextResponse.redirect(newUrl), canonicalPath.locale);
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
