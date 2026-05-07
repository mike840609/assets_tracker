import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable",
);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seed data script disabled because database now requires auth users.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
