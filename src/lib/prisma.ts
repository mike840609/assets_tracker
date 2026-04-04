import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Replace weaker SSL modes with verify-full to silence the pg v8 deprecation
  // warning and stay forward-compatible with pg v9.
  const url = process.env.DATABASE_URL!.replace(
    /sslmode=(prefer|require|verify-ca)/,
    "sslmode=verify-full"
  );
  const adapter = new PrismaPg(url);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
