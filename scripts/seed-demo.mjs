// Seeds the local dev DB with demo data for the preview user so the dashboard,
// history chart, and analysis pages render populated without waiting for the
// daily cron. Idempotent: wipes and re-inserts the preview user's data.
//
//   pnpm seed:demo
import nextEnv from "@next/env";
import pg from "pg";
import { randomUUID } from "node:crypto";

import {
  BASE_CURRENCY,
  HISTORY_DAYS,
  PRICES,
  TWD_TO_USD,
  buildSnapshotHistory,
  createDemoAccounts,
  portfolioTotals,
} from "./demo-data.mjs";

nextEnv.loadEnvConfig(process.cwd(), true);

const DEMO_EMAIL = "e2e-test@preview.local";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) && !process.argv.includes("--force")) {
  console.error(`Refusing to seed non-local database (${url.hostname}). Pass --force to override.`);
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const id = () => randomUUID();
const accounts = createDemoAccounts(id);
const { netWorth } = portfolioTotals(accounts);
const snapshots = buildSnapshotHistory(accounts, new Date());

try {
  await db.query("BEGIN");

  // User + settings (same upsert shape as the preview login in src/auth.ts)
  const userRes = await db.query(
    `INSERT INTO "User" (id, email, name) VALUES ($1, $2, 'E2E Test User')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [id(), DEMO_EMAIL],
  );
  const userId = userRes.rows[0].id;
  await db.query(
    `INSERT INTO "Setting" (id, "userId", "baseCurrency", locale, "updatedAt") VALUES ($1, $2, $3, 'en-US', now())
     ON CONFLICT ("userId") DO UPDATE SET "baseCurrency" = EXCLUDED."baseCurrency"`,
    [id(), userId, BASE_CURRENCY],
  );

  // Wipe previous demo data (accounts cascade to holdings/transactions)
  for (const table of ["Account", "NetWorthSnapshot", "Goal", "StockWatchItem"]) {
    await db.query(`DELETE FROM "${table}" WHERE "userId" = $1`, [userId]);
  }

  // Prices + FX so nothing needs a live API to render
  for (const [symbol, price] of Object.entries(PRICES)) {
    await db.query(
      `INSERT INTO "PriceCache" (symbol, price, currency, "updatedAt") VALUES ($1, $2, 'USD', now())
       ON CONFLICT (symbol) DO UPDATE SET price = EXCLUDED.price, "updatedAt" = now()`,
      [symbol, price],
    );
  }
  for (const [from, to, rate] of [
    ["TWD", "USD", TWD_TO_USD],
    ["USD", "TWD", 1 / TWD_TO_USD],
  ]) {
    await db.query(
      `INSERT INTO "ExchangeRate" ("fromCurrency", "toCurrency", rate, "updatedAt") VALUES ($1, $2, $3, now())
       ON CONFLICT ("fromCurrency", "toCurrency") DO UPDATE SET rate = EXCLUDED.rate, "updatedAt" = now()`,
      [from, to, rate],
    );
  }

  // Accounts and their realistic, dated holding/cash activity.
  for (const [i, a] of accounts.entries()) {
    await db.query(
      `INSERT INTO "Account" (id, "userId", name, type, category, currency, "cashBalance", "sortOrder", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [a.id, userId, a.name, a.type, a.category, a.currency, a.cash, i],
    );
    for (const h of a.holdings) {
      const holdingId = id();
      await db.query(
        `INSERT INTO "Holding" (id, "accountId", symbol, name, quantity, currency, "assetType", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'USD', $6, now())`,
        [holdingId, a.id, h.symbol, h.name, h.quantity, h.assetType],
      );
      for (const transaction of h.transactions) {
        await db.query(
          `INSERT INTO "HoldingTransaction" (id, "holdingId", type, quantity, "unitPrice", note, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(days => $7))`,
          [
            id(),
            holdingId,
            transaction.type,
            transaction.quantity,
            transaction.unitPrice,
            transaction.note,
            transaction.daysAgo,
          ],
        );
      }
    }
    for (const transaction of a.cashTransactions) {
      await db.query(
        `INSERT INTO "CashTransaction" (id, "accountId", type, amount, note, "createdAt")
         VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6))`,
        [id(), a.id, transaction.type, transaction.amount, transaction.note, transaction.daysAgo],
      );
    }
  }

  await db.query(
    `INSERT INTO "Goal" (id, "userId", name, "targetAmount", "targetCurrency", "targetDate", scope, "updatedAt")
     VALUES ($1, $2, 'Reach $100k net worth', 100000, 'USD', '2027-12-31', 'NET_WORTH', now())`,
    [id(), userId],
  );

  // Deterministic, category-specific history ending at today's exact valuation.
  for (const snapshot of snapshots) {
    await db.query(
      `INSERT INTO "NetWorthSnapshot" (id, "userId", date, "totalAssets", "totalLiabilities", "netWorth", "baseCurrency", breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id(),
        userId,
        snapshot.date,
        snapshot.totalAssets.toFixed(2),
        snapshot.totalLiabilities.toFixed(2),
        snapshot.netWorth.toFixed(2),
        BASE_CURRENCY,
        snapshot.breakdown,
      ],
    );
  }

  await db.query("COMMIT");
} catch (err) {
  await db.query("ROLLBACK");
  throw err;
} finally {
  await db.end();
}

console.log(`Seeded demo data for ${DEMO_EMAIL}:`);
console.log(
  `- ${accounts.length} accounts, ${accounts.reduce((s, a) => s + a.holdings.length, 0)} holdings, ${HISTORY_DAYS} snapshots`,
);
console.log(`- net worth: $${netWorth.toFixed(2)} ${BASE_CURRENCY}`);
console.log(`Restart the dev server (or trigger any mutation) if cached pages still show empty.`);
