import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd(), true);

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

function classifyHost(hostname) {
  if (hostname.includes("neon.tech")) return "Neon";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "Local PostgreSQL";
  return "PostgreSQL";
}

function adapterFor(hostname) {
  return hostname.includes("neon.tech") ? "PrismaNeon" : "PrismaPg";
}

function summarizeConnection(value) {
  if (!value) return "unset";

  try {
    const url = new URL(value);
    const host = url.hostname;
    const port = url.port ? `:${url.port}` : "";
    const database = url.pathname.replace(/^\//, "") || "(none)";
    const sslmode = url.searchParams.get("sslmode");
    const ssl = sslmode ? ` sslmode=${sslmode}` : "";

    return `${classifyHost(host)} (${adapterFor(host)}) host=${host}${port} db=${database}${ssl}`;
  } catch {
    return "invalid PostgreSQL URL";
  }
}

function printInfo(label, value) {
  console.log(`- ${`${label}:`.padEnd(15)}${value}`);
}

printInfo("Database", summarizeConnection(databaseUrl));

if (directUrl && directUrl !== databaseUrl) {
  printInfo("Direct URL", `${summarizeConnection(directUrl)} (Prisma CLI/migrations only)`);
}
