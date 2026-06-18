import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { lstatSync, readlinkSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// When the worktree's node_modules is a symlink to a shared cache outside the
// project tree (see scripts/setup-worktree.mjs), Turbopack's filesystem-root
// guard rejects it ("Symlink ... points out of the filesystem root"). Widen
// the root to the deepest common ancestor of the project and the symlink
// target so resolution succeeds. No-op for normal installs.
function detectTurbopackRoot(): string | undefined {
  try {
    const project = process.cwd();
    const nm = join(project, "node_modules");
    if (!lstatSync(nm).isSymbolicLink()) return undefined;
    const target = resolve(project, readlinkSync(nm));
    if (target.startsWith(project + sep)) return undefined;
    const a = project.split(sep);
    const b = target.split(sep);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return a.slice(0, i).join(sep) || sep;
  } catch {
    return undefined;
  }
}

const turbopackRoot = detectTurbopackRoot();
if (turbopackRoot) {
  console.log(`[next.config] Widened turbopack.root to ${turbopackRoot} (symlinked node_modules).`);
}

const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  // E19 — Sentry's browser SDK POSTs events to its ingest endpoint. The host is
  // org/region-specific (`https://o<orgid>.ingest.<region>.sentry.io` or the
  // non-regional `https://o<orgid>.ingest.sentry.io`), so both wildcard forms
  // are allowlisted. Without these, client-side reporting is blocked by CSP.
  `connect-src 'self' https://va.vercel-scripts.com https://api.frankfurter.app https://open.er-api.com https://api.coingecko.com https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io${isDev ? " http: ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-uri /api/csp/report",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  ...(turbopackRoot ? { turbopack: { root: turbopackRoot } } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  experimental: {
    viewTransition: true,
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "next-intl",
      "@prisma/client",
      "@base-ui/react",
    ],
  },
  serverExternalPackages: ["ws", "@neondatabase/serverless", "pg"],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
        // R1 — Baseline security headers
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        },
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy,
        },
      ],
    },
    // V20 — the service worker must never be long-cached or clients can get
    // stuck on a stale SW. Pinned explicitly so a future broad caching
    // pattern can't accidentally cover it.
    {
      source: "/sw.js",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
    },
  ],
};

const wrappedConfig = withNextIntl(nextConfig);

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// E19 — Sentry build-time plugin. Wrapping is always applied (it injects the
// runtime instrumentation), but it stays inert at runtime when no SENTRY_DSN is
// configured. Source-map upload is gated on SENTRY_AUTH_TOKEN so builds without
// it (local / CI / preview) never fail: when absent, `authToken` is undefined
// and the plugin skips upload. `silent` keeps build logs quiet outside CI.
export default withSentryConfig(withBundleAnalyzer(wrappedConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Only upload source maps when an auth token is present; otherwise skip the
  // release/upload step entirely so token-less builds succeed.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Reduce bundle size by stripping Sentry SDK logger statements from prod.
  disableLogger: true,
  // Avoid CSP/ad-blocker tunneling indirection by default; not enabled here.
  widenClientFileUpload: true,
});
