import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";
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
      ],
    },
  ],
};

const wrappedConfig = withNextIntl(nextConfig);

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withBundleAnalyzer(wrappedConfig);
