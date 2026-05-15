import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { DATABASE_URL } from "@/lib/env";

// Enable WebSocket connections for non-edge environments (Node.js)
neonConfig.webSocketConstructor = ws;

function createPrismaClient() {
  const connectionString = DATABASE_URL;
  // PrismaNeon takes a PoolConfig and manages the pool internally
  const adapter = new PrismaNeon({ connectionString });
  const client = new PrismaClient({ adapter });

  return client.$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now();
        const result = await query(args);
        const durationMs = Date.now() - start;
        if (durationMs > 1000) {
          // Dynamic import avoids a circular-module issue at startup
          const { log } = await import("@/lib/logger");
          log.warn("prisma.slow_query", { model, operation, durationMs });
        }
        return result;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
