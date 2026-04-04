import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "date-fns"],
  },
};

export default nextConfig;
