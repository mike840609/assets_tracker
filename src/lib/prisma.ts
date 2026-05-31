import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import pg from "pg";
import { DATABASE_URL } from "@/lib/env";

function createPrismaClient() {
  const connectionString = DATABASE_URL;
  const isNeon = connectionString.includes("neon.tech");

  let adapter;
  if (isNeon) {
    // Enable WebSocket connections for non-edge environments (Node.js)
    neonConfig.webSocketConstructor = ws;
    adapter = new PrismaNeon({ connectionString });
  } else {
    // Standard PostgreSQL database (e.g. local Docker PG)
    const pool = new pg.Pool({ connectionString });
    adapter = new PrismaPg(pool);
  }

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
