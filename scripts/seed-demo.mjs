// Seeds the local dev DB with demo data for the preview user so the dashboard,
// history chart, and analysis pages render populated without waiting for the
// daily cron. Idempotent: wipes and re-inserts the preview user's data.
//
//   pnpm seed:demo
import nextEnv from "@next/env";
import pg from "pg";
import { randomUUID } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd(), true);

const DEMO_EMAIL = "e2e-test@preview.local";
const BASE_CURRENCY = "USD";
const HISTORY_DAYS = 180;

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) && !process.argv.includes("--force")) {
  console.error(`Refusing to seed non-local database (${url.hostname}). Pass --force to override.`);
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const id = () => randomUUID();

// ---------- demo dataset ----------
const prices = {
  AAPL: 235.1,
  VOO: 560.25,
  "BTC-USD": 95400,
};
const twdToUsd = 0.031;

const accounts = [
  {
    id: id(),
    name: "Cathay Bank",
    type: "ASSET",
    category: "BANK",
    currency: "TWD",
    cash: 450000,
    holdings: [],
  },
  {
    id: id(),
    name: "Fidelity Brokerage",
    type: "ASSET",
    category: "BROKERAGE",
    currency: "USD",
    cash: 2500,
    holdings: [
      { symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK", quantity: 25, costPerUnit: 182.4 },
      {
        symbol: "VOO",
        name: "Vanguard S&P 500 ETF",
        assetType: "ETF",
        quantity: 18,
        costPerUnit: 471.1,
      },
    ],
  },
  {
    id: id(),
    name: "Cold Wallet",
    type: "ASSET",
    category: "CRYPTO_WALLET",
    currency: "USD",
    cash: 0,
    holdings: [
      {
        symbol: "BTC-USD",
        name: "Bitcoin",
        assetType: "CRYPTO",
        quantity: 0.15,
        costPerUnit: 61200,
      },
    ],
  },
  {
    id: id(),
    name: "Visa Credit Card",
    type: "LIABILITY",
    category: "CREDIT_CARD",
    currency: "USD",
    cash: 1200,
    holdings: [],
  },
];

// Account value in its own currency (matches net-worth-service: cash + holdings).
const accountValue = (a) =>
  a.cash + a.holdings.reduce((s, h) => s + h.quantity * prices[h.symbol], 0);
const toUsd = (a) => accountValue(a) * (a.currency === "TWD" ? twdToUsd : 1);
const totalAssets = accounts.filter((a) => a.type === "ASSET").reduce((s, a) => s + toUsd(a), 0);
const totalLiabilities = accounts
  .filter((a) => a.type === "LIABILITY")
  .reduce((s, a) => s + toUsd(a), 0);
const netWorth = totalAssets - totalLiabilities;

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
  for (const [symbol, price] of Object.entries(prices)) {
    await db.query(
      `INSERT INTO "PriceCache" (symbol, price, currency, "updatedAt") VALUES ($1, $2, 'USD', now())
       ON CONFLICT (symbol) DO UPDATE SET price = EXCLUDED.price, "updatedAt" = now()`,
      [symbol, price],
    );
  }
  for (const [from, to, rate] of [
    ["TWD", "USD", twdToUsd],
    ["USD", "TWD", 1 / twdToUsd],
  ]) {
    await db.query(
      `INSERT INTO "ExchangeRate" ("fromCurrency", "toCurrency", rate, "updatedAt") VALUES ($1, $2, $3, now())
       ON CONFLICT ("fromCurrency", "toCurrency") DO UPDATE SET rate = EXCLUDED.rate, "updatedAt" = now()`,
      [from, to, rate],
    );
  }

  // Accounts, holdings (with a BUY transaction as cost basis), some cash history
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
      await db.query(
        `INSERT INTO "HoldingTransaction" (id, "holdingId", type, quantity, "unitPrice", note, "createdAt")
         VALUES ($1, $2, 'BUY', $3, $4, 'Demo seed', now() - interval '150 days')`,
        [id(), holdingId, h.quantity, h.costPerUnit],
      );
    }
  }
  const bank = accounts[0];
  for (const daysAgo of [90, 60, 30]) {
    await db.query(
      `INSERT INTO "CashTransaction" (id, "accountId", type, amount, note, "createdAt")
       VALUES ($1, $2, 'DEPOSIT', 50000, 'Salary', now() - make_interval(days => $3))`,
      [id(), bank.id, daysAgo],
    );
  }

  await db.query(
    `INSERT INTO "Goal" (id, "userId", name, "targetAmount", "targetCurrency", "targetDate", scope, "updatedAt")
     VALUES ($1, $2, 'Reach $100k net worth', 100000, 'USD', '2027-12-31', 'NET_WORTH', now())`,
    [id(), userId],
  );

  // Snapshot history: HISTORY_DAYS of gentle growth ending at today's exact
  // computed net worth, bucketed by Taiwan calendar day like snapshot-service.
  const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taiwanNow = new Date(Date.now() + TAIWAN_OFFSET_MS);
  const todayUtc = Date.UTC(
    taiwanNow.getUTCFullYear(),
    taiwanNow.getUTCMonth(),
    taiwanNow.getUTCDate(),
  );
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = new Date(todayUtc - i * 86400000);
    const progress = (HISTORY_DAYS - 1 - i) / (HISTORY_DAYS - 1); // 0 → 1
    // ponytail: deterministic sine wiggle instead of random noise, keeps re-runs identical
    const factor = 0.78 + 0.22 * progress + 0.02 * Math.sin(i / 9);
    const scale = i === 0 ? 1 : factor;
    const assets = totalAssets * scale;
    const liabilities = totalLiabilities;
    const breakdown = Object.fromEntries(
      accounts.map((a) => [a.id, { value: accountValue(a) * scale, currency: a.currency }]),
    );
    await db.query(
      `INSERT INTO "NetWorthSnapshot" (id, "userId", date, "totalAssets", "totalLiabilities", "netWorth", "baseCurrency", breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id(),
        userId,
        date,
        assets.toFixed(2),
        liabilities.toFixed(2),
        (assets - liabilities).toFixed(2),
        BASE_CURRENCY,
        breakdown,
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
