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
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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

// Shift every dated row forward so the last snapshot = today (Taiwan day).
const DAY_MS = 24 * 60 * 60 * 1000;
const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;
const taiwanNow = new Date(Date.now() + TAIWAN_OFFSET_MS);
const todayUtc = Date.UTC(
  taiwanNow.getUTCFullYear(),
  taiwanNow.getUTCMonth(),
  taiwanNow.getUTCDate(),
);
const lastSnapshotUtc = Math.max(...demo.snapshots.map((s) => Date.parse(s.date)));
const shiftMs = Math.round((todayUtc - lastSnapshotUtc) / DAY_MS) * DAY_MS;
const shift = (iso) => (iso == null ? null : new Date(Date.parse(iso) + shiftMs).toISOString());

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const id = () => randomUUID();

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
    `INSERT INTO "Setting" (id, "userId", "baseCurrency", locale, "updatedAt") VALUES ($1, $2, $3, $4, now())
     ON CONFLICT ("userId") DO UPDATE SET "baseCurrency" = EXCLUDED."baseCurrency", locale = EXCLUDED.locale`,
    [id(), userId, demo.settings.baseCurrency, demo.settings.locale],
  );

  // Wipe previous demo data (accounts cascade to holdings/transactions/recurring)
  for (const table of ["Account", "NetWorthSnapshot", "Goal", "StockWatchItem"]) {
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

  // Accounts keep their JSON ids so snapshot breakdown keys and goal
  // scopeRefId references line up without remapping.
  for (const a of demo.accounts) {
    await db.query(
      `INSERT INTO "Account" (id, "userId", name, type, category, currency, "cashBalance", "isActive", "isPinned", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        a.id,
        userId,
        a.name,
        a.type,
        a.category,
        a.currency,
        a.cashBalance,
        a.isActive,
        a.isPinned,
        a.sortOrder,
        shift(a.createdAt),
        shift(a.updatedAt),
      ],
    );
    for (const rule of a.recurringCashTransactions ?? []) {
      await db.query(
        `INSERT INTO "RecurringCashTransaction" (id, "accountId", type, amount, frequency, note, "startDate", "nextRunDate", "isActive", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [
          id(),
          a.id,
          rule.type,
          rule.amount,
          rule.frequency,
          rule.note,
          shift(rule.startDate),
          shift(rule.nextRunDate),
          rule.isActive,
        ],
      );
    }
    for (const rule of a.recurringInvestments ?? []) {
      await db.query(
        `INSERT INTO "RecurringInvestment" (id, "accountId", symbol, name, "assetType", "holdingCurrency", amount, frequency, note, "startDate", "nextRunDate", "isActive", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
        [
          id(),
          a.id,
          rule.symbol,
          rule.name,
          rule.assetType,
          rule.holdingCurrency,
          rule.amount,
          rule.frequency,
          rule.note,
          shift(rule.startDate),
          shift(rule.nextRunDate),
          rule.isActive,
        ],
      );
    }
    for (const h of a.holdings ?? []) {
      const holdingId = id();
      await db.query(
        `INSERT INTO "Holding" (id, "accountId", symbol, name, quantity, currency, "assetType", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          holdingId,
          a.id,
          h.symbol,
          h.name,
          h.quantity,
          h.currency,
          h.assetType,
          shift(h.createdAt),
          shift(h.updatedAt),
        ],
      );
      for (const t of h.transactions ?? []) {
        await db.query(
          `INSERT INTO "HoldingTransaction" (id, "holdingId", type, quantity, "unitPrice", note, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id(), holdingId, t.type, t.quantity, t.unitPrice, t.note, shift(t.createdAt)],
        );
      }
    }
    for (const t of a.cashTransactions ?? []) {
      await db.query(
        `INSERT INTO "CashTransaction" (id, "accountId", type, amount, note, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id(), a.id, t.type, t.amount, t.note, shift(t.createdAt)],
      );
    }
  }

  for (const s of demo.snapshots) {
    await db.query(
      `INSERT INTO "NetWorthSnapshot" (id, "userId", date, "totalAssets", "totalLiabilities", "netWorth", "baseCurrency", breakdown, label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id(),
        userId,
        shift(s.date),
        s.totalAssets,
        s.totalLiabilities,
        s.netWorth,
        s.baseCurrency,
        s.breakdown,
        s.label ?? null,
      ],
    );
  }

  for (const g of demo.goals ?? []) {
    await db.query(
      `INSERT INTO "Goal" (id, "userId", name, "targetAmount", "targetCurrency", "targetDate", scope, "scopeRefId", "sortOrder", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        id(),
        userId,
        g.name,
        g.targetAmount,
        g.targetCurrency,
        g.targetDate,
        g.scope,
        g.scopeRefId ?? null,
        g.sortOrder,
      ],
    );
  }

  for (const w of demo.stockWatchItems ?? []) {
    await db.query(
      `INSERT INTO "StockWatchItem" (id, "userId", symbol, name, exchange, currency, "recordPrice", "recordDate", note, "sortOrder", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        id(),
        userId,
        w.symbol,
        w.name,
        w.exchange,
        w.currency,
        w.recordPrice,
        w.recordDate,
        w.note,
        w.sortOrder,
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

const last = demo.snapshots.at(-1);
console.log(`Seeded demo data for ${DEMO_EMAIL} (dates shifted +${shiftMs / DAY_MS} days):`);
console.log(
  `- ${demo.accounts.length} accounts, ${demo.accounts.reduce((s, a) => s + (a.holdings?.length ?? 0), 0)} holdings, ${demo.snapshots.length} snapshots, ${demo.goals.length} goals, ${demo.stockWatchItems.length} watch items`,
);
console.log(
  `- latest snapshot: assets ${last.totalAssets} / net ${last.netWorth} ${last.baseCurrency}`,
);
console.log(`Restart the dev server (or trigger any mutation) if cached pages still show empty.`);
