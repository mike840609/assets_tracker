// Seeds the local dev DB with demo data for the preview user so the dashboard,
// history chart, and analysis pages render populated without waiting for the
// daily cron. Idempotent: wipes and re-inserts the preview user's data.
//
// Source of truth is demo-data.json (repo root) — the same file users can
// import via Settings → Data. All dated rows are shifted so the newest
// snapshot lands on today's Taiwan calendar day, keeping the demo evergreen.
//
//   pnpm seed:demo
import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

import { instantiateDemoFixture, shiftDemoFixtureDates } from "../src/lib/demo/demo-fixture.ts";

nextEnv.loadEnvConfig(process.cwd(), true);

const DEMO_EMAIL = "e2e-test@preview.local";

// Offline prices/FX so nothing needs a live API to render. Point-in-time
// (2026-07-17 closes); holdings values just need to be plausible, not live.
const PRICES = {
  "2330.TW": { price: 2290, currency: "TWD" },
  "0050.TW": { price: 100.15, currency: "TWD" },
  NVDA: { price: 202.81, currency: "USD" },
  TSLA: { price: 380.84, currency: "USD" },
  AAPL: { price: 333.74, currency: "USD" },
  VOO: { price: 683.17, currency: "USD" },
  GOOGL: { price: 346.77, currency: "USD" },
};
const USD_TO_TWD = 32.37;

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) && !process.argv.includes("--force")) {
  console.error(`Refusing to seed non-local database (${url.hostname}). Pass --force to override.`);
  process.exit(1);
}

const demo = JSON.parse(readFileSync(new URL("../demo-data.json", import.meta.url), "utf8"));

// Keep the seed's Taiwan-day input local; the shared fixture module owns all
// date shifting and reference remapping.
const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;
const taiwanNow = new Date(Date.now() + TAIWAN_OFFSET_MS);
const taiwanDay = new Date(
  Date.UTC(taiwanNow.getUTCFullYear(), taiwanNow.getUTCMonth(), taiwanNow.getUTCDate()),
);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  await db.query("BEGIN");

  // User + settings (same upsert shape as the preview login in src/auth.ts)
  const userRes = await db.query(
    `INSERT INTO "User" (id, email, name) VALUES ($1, $2, 'E2E Test User')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [randomUUID(), DEMO_EMAIL],
  );
  const userId = userRes.rows[0].id;
  const shifted = shiftDemoFixtureDates(demo, taiwanDay);
  const prepared = instantiateDemoFixture(shifted, {
    userId,
    locale: demo.settings?.locale === "zh-TW" ? "zh-TW" : "en-US",
    now: taiwanDay,
    makeId: randomUUID,
  });

  await db.query(
    `INSERT INTO "Setting" (id, "userId", "baseCurrency", locale, "updatedAt") VALUES ($1, $2, $3, $4, now())
     ON CONFLICT ("userId") DO UPDATE SET "baseCurrency" = EXCLUDED."baseCurrency", locale = EXCLUDED.locale`,
    [
      prepared.settings.id,
      prepared.settings.userId,
      prepared.settings.baseCurrency,
      prepared.settings.locale,
    ],
  );

  // Wipe previous demo data (accounts cascade to holdings/transactions/recurring).
  for (const table of ["Account", "NetWorthSnapshot", "Goal", "StockWatchItem", "CalendarEntry"]) {
    await db.query(`DELETE FROM "${table}" WHERE "userId" = $1`, [userId]);
  }

  for (const [symbol, { price, currency }] of Object.entries(PRICES)) {
    await db.query(
      `INSERT INTO "PriceCache" (symbol, price, currency, "updatedAt") VALUES ($1, $2, $3, now())
       ON CONFLICT (symbol) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, "updatedAt" = now()`,
      [symbol, price, currency],
    );
  }
  for (const [from, to, rate] of [
    ["USD", "TWD", USD_TO_TWD],
    ["TWD", "USD", 1 / USD_TO_TWD],
  ]) {
    await db.query(
      `INSERT INTO "ExchangeRate" ("fromCurrency", "toCurrency", rate, "updatedAt") VALUES ($1, $2, $3, now())
       ON CONFLICT ("fromCurrency", "toCurrency") DO UPDATE SET rate = EXCLUDED.rate, "updatedAt" = now()`,
      [from, to, rate],
    );
  }

  for (const account of prepared.accounts) {
    await db.query(
      `INSERT INTO "Account" (id, "userId", name, type, category, currency, "cashBalance", "isActive", "isPinned", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        account.id,
        account.userId,
        account.name,
        account.type,
        account.category,
        account.currency,
        account.cashBalance,
        account.isActive,
        account.isPinned,
        account.sortOrder,
        account.createdAt,
        account.updatedAt,
      ],
    );
  }
  for (const holding of prepared.holdings) {
    await db.query(
      `INSERT INTO "Holding" (id, "accountId", symbol, name, quantity, currency, "assetType", "underlyingSymbol", "optionType", strike, expiration, "contractMultiplier", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        holding.id,
        holding.accountId,
        holding.symbol,
        holding.name,
        holding.quantity,
        holding.currency,
        holding.assetType,
        holding.underlyingSymbol,
        holding.optionType,
        holding.strike,
        holding.expiration,
        holding.contractMultiplier,
        holding.createdAt,
        holding.updatedAt,
      ],
    );
  }
  for (const rule of prepared.recurringCashTransactions) {
    await db.query(
      `INSERT INTO "RecurringCashTransaction" (id, "accountId", type, amount, frequency, note, "startDate", "endDate", "nextRunDate", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        rule.id,
        rule.accountId,
        rule.type,
        rule.amount,
        rule.frequency,
        rule.note,
        rule.startDate,
        rule.endDate,
        rule.nextRunDate,
        rule.isActive,
        rule.createdAt,
        rule.updatedAt,
      ],
    );
  }
  for (const rule of prepared.recurringInvestments) {
    await db.query(
      `INSERT INTO "RecurringInvestment" (id, "accountId", symbol, name, "assetType", "holdingCurrency", amount, frequency, note, "startDate", "endDate", "nextRunDate", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        rule.id,
        rule.accountId,
        rule.symbol,
        rule.name,
        rule.assetType,
        rule.holdingCurrency,
        rule.amount,
        rule.frequency,
        rule.note,
        rule.startDate,
        rule.endDate,
        rule.nextRunDate,
        rule.isActive,
        rule.createdAt,
        rule.updatedAt,
      ],
    );
  }
  for (const transaction of prepared.cashTransactions) {
    await db.query(
      `INSERT INTO "CashTransaction" (id, "accountId", type, amount, note, "createdAt", "occurrenceDate", "recurringId", "materializedAt", "materializedAtEstimated")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        transaction.id,
        transaction.accountId,
        transaction.type,
        transaction.amount,
        transaction.note,
        transaction.createdAt,
        transaction.occurrenceDate,
        transaction.recurringId,
        transaction.materializedAt,
        transaction.materializedAtEstimated,
      ],
    );
  }
  for (const transaction of prepared.holdingTransactions) {
    await db.query(
      `INSERT INTO "HoldingTransaction" (id, "holdingId", type, quantity, "unitPrice", note, "createdAt", "occurrenceDate", "recurringId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        transaction.id,
        transaction.holdingId,
        transaction.type,
        transaction.quantity,
        transaction.unitPrice,
        transaction.note,
        transaction.createdAt,
        transaction.occurrenceDate,
        transaction.recurringId,
      ],
    );
  }
  for (const snapshot of prepared.snapshots) {
    await db.query(
      `INSERT INTO "NetWorthSnapshot" (id, "userId", date, "totalAssets", "totalLiabilities", "netWorth", "baseCurrency", breakdown, label, note, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        snapshot.id,
        snapshot.userId,
        snapshot.date,
        snapshot.totalAssets,
        snapshot.totalLiabilities,
        snapshot.netWorth,
        snapshot.baseCurrency,
        snapshot.breakdown,
        snapshot.label,
        snapshot.note,
        snapshot.createdAt,
      ],
    );
  }
  for (const goal of prepared.goals) {
    await db.query(
      `INSERT INTO "Goal" (id, "userId", name, "targetAmount", "targetCurrency", "targetDate", scope, "scopeRefId", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        goal.id,
        goal.userId,
        goal.name,
        goal.targetAmount,
        goal.targetCurrency,
        goal.targetDate,
        goal.scope,
        goal.scopeRefId,
        goal.sortOrder,
        goal.createdAt,
        goal.updatedAt,
      ],
    );
  }
  for (const stock of prepared.stockWatchItems) {
    await db.query(
      `INSERT INTO "StockWatchItem" (id, "userId", symbol, name, exchange, currency, "recordPrice", "recordDate", note, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        stock.id,
        stock.userId,
        stock.symbol,
        stock.name,
        stock.exchange,
        stock.currency,
        stock.recordPrice,
        stock.recordDate,
        stock.note,
        stock.sortOrder,
        stock.createdAt,
        stock.updatedAt,
      ],
    );
  }
  for (const entry of prepared.calendarEntries) {
    await db.query(
      `INSERT INTO "CalendarEntry" (id, "userId", title, "eventDate", "startTimeMinutes", "timeZone", category, description, "sourceUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.id,
        entry.userId,
        entry.title,
        entry.eventDate,
        entry.startTimeMinutes,
        entry.timeZone,
        entry.category,
        entry.description,
        entry.sourceUrl,
        entry.createdAt,
        entry.updatedAt,
      ],
    );
  }

  await db.query("COMMIT");

  const last = prepared.snapshots.at(-1);
  console.log(
    `Seeded demo data for ${DEMO_EMAIL} (dates shifted to ${taiwanDay.toISOString().slice(0, 10)}):`,
  );
  console.log(
    `- ${prepared.accounts.length} accounts, ${prepared.holdings.length} holdings, ${prepared.snapshots.length} snapshots, ${prepared.goals.length} goals, ${prepared.stockWatchItems.length} watch items`,
  );
  console.log(
    `- latest snapshot: assets ${last?.totalAssets} / net ${last?.netWorth} ${last?.baseCurrency}`,
  );
  console.log(`Restart the dev server (or trigger any mutation) if cached pages still show empty.`);
} catch (err) {
  await db.query("ROLLBACK");
  throw err;
} finally {
  await db.end();
}
