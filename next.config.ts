import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    ppr: "incremental",
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "date-fns",
      "next-intl",
      "@prisma/client",
    ],
  },
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
      ],
    },
  ],
};

export default withNextIntl(nextConfig);
