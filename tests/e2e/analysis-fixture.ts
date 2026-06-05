import { loadEnvConfig } from "@next/env";
import pg from "pg";
import { randomUUID } from "node:crypto";

const E2E_EMAIL = "e2e-test@preview.local";
const FIXTURE_PREFIX = "E2E Analysis QA";
const BASE_CURRENCY = "USD";
const MONTH_COUNT = 18;

loadEnvConfig(process.cwd());

export function hasAnalysisFixtureDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function createDbPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the populated Analysis fixture.");
  }

  return new pg.Pool({
    connectionString,
    ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
  });
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function fixtureMonths() {
  const currentMonth = monthStart(new Date());
  const firstMonth = addMonths(currentMonth, -(MONTH_COUNT - 1));
  return Array.from({ length: MONTH_COUNT }, (_, index) => addMonths(firstMonth, index));
}

interface AnalysisFixture {
  snapshotDates: string[];
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getOrCreateE2eUser(pool: pg.Pool) {
  const userId = randomUUID();
  const user = await pool.query<{ id: string }>(
    `
      INSERT INTO "User" ("id", "email", "name")
      VALUES ($1, $2, $3)
      ON CONFLICT ("email") DO UPDATE SET "name" = COALESCE("User"."name", EXCLUDED."name")
      RETURNING "id"
    `,
    [userId, E2E_EMAIL, "E2E Test User"],
  );
  const id = user.rows[0].id;

  await pool.query(
    `
      INSERT INTO "Setting" ("id", "userId", "baseCurrency", "locale", "updatedAt")
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT ("userId") DO UPDATE
      SET "baseCurrency" = EXCLUDED."baseCurrency",
          "locale" = EXCLUDED."locale",
          "updatedAt" = now()
    `,
    [randomUUID(), id, BASE_CURRENCY, "en-US"],
  );

  return { id };
}

async function removeFixtureData(pool: pg.Pool, userId: string, snapshotDates: string[]) {
  await pool.query(`DELETE FROM "Account" WHERE "userId" = $1 AND "name" LIKE $2`, [
    userId,
    `${FIXTURE_PREFIX}%`,
  ]);
  await pool.query(
    `DELETE FROM "NetWorthSnapshot" WHERE "userId" = $1 AND "baseCurrency" = $2 AND "date" = ANY($3::date[])`,
    [userId, BASE_CURRENCY, snapshotDates],
  );
}

export async function seedAnalysisFixture(): Promise<AnalysisFixture> {
  const pool = createDbPool();
  const snapshotDates = fixtureMonths().map(toDateKey);

  try {
    const user = await getOrCreateE2eUser(pool);
    await removeFixtureData(pool, user.id, snapshotDates);

    const accountInputs = [
      [`${FIXTURE_PREFIX} Checking`, "ASSET", "BANK", 22_400, 0],
      [`${FIXTURE_PREFIX} Brokerage`, "ASSET", "BROKERAGE", 128_000, 1],
      [`${FIXTURE_PREFIX} Crypto`, "ASSET", "CRYPTO_WALLET", 34_500, 2],
      [`${FIXTURE_PREFIX} Home`, "ASSET", "PROPERTY", 466_000, 3],
      [`${FIXTURE_PREFIX} Vehicle`, "ASSET", "VEHICLE", 20_300, 4],
      [`${FIXTURE_PREFIX} Card`, "LIABILITY", "CREDIT_CARD", 2_200, 5],
      [`${FIXTURE_PREFIX} Loan`, "LIABILITY", "LOAN", 45_000, 6],
    ] as const;

    const accounts = await Promise.all(
      accountInputs.map(async ([name, type, category, cashBalance, sortOrder]) => {
        const account = await pool.query<{ id: string }>(
          `
            INSERT INTO "Account"
              ("id", "userId", "name", "type", "category", "currency", "cashBalance", "sortOrder", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
            RETURNING "id"
          `,
          [randomUUID(), user.id, name, type, category, BASE_CURRENCY, cashBalance, sortOrder],
        );
        return { id: account.rows[0].id };
      }),
    );

    const [bank, brokerage, crypto, property, vehicle, card, loan] = accounts;

    for (const [index, dateKey] of snapshotDates.entries()) {
      const date = new Date(`${dateKey}T00:00:00.000Z`);
      const rows = [
        [bank.id, "DEPOSIT", 700 + (index % 3) * 125, 5],
        [brokerage.id, "DEPOSIT", 1_200 + (index % 4) * 200, 12],
        [card.id, "WITHDRAWAL", 120 + (index % 2) * 60, 18],
      ] as const;

      for (const [accountId, type, amount, day] of rows) {
        await pool.query(
          `
            INSERT INTO "CashTransaction" ("id", "accountId", "type", "amount", "note", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            randomUUID(),
            accountId,
            type,
            amount,
            "Analysis populated QA fixture",
            new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day, 12)),
          ],
        );
      }
    }

    for (const [index, dateKey] of snapshotDates.entries()) {
      const date = new Date(`${dateKey}T00:00:00.000Z`);
      const wave = Math.sin(index / 2.4);
      const values = {
        [bank.id]: 8_500 + index * 825,
        [brokerage.id]: 72_000 + index * 2_450 + wave * 4_800,
        [crypto.id]: 18_000 + index * 850 + Math.cos(index / 1.8) * 3_200,
        [property.id]: 420_000 + index * 1_900,
        [vehicle.id]: 29_000 - index * 475,
        [card.id]: Math.max(1_200, 4_900 - index * 210),
        [loan.id]: Math.max(36_000, 63_000 - index * 1_150),
      };
      const totalAssets =
        values[bank.id] +
        values[brokerage.id] +
        values[crypto.id] +
        values[property.id] +
        values[vehicle.id];
      const totalLiabilities = values[card.id] + values[loan.id];
      const breakdown = Object.fromEntries(
        accounts.map((account) => [
          account.id,
          {
            value: values[account.id],
            currency: BASE_CURRENCY,
          },
        ]),
      );

      await pool.query(
        `
          INSERT INTO "NetWorthSnapshot"
            ("id", "userId", "date", "totalAssets", "totalLiabilities", "netWorth", "baseCurrency", "breakdown", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          user.id,
          dateKey,
          totalAssets,
          totalLiabilities,
          totalAssets - totalLiabilities,
          BASE_CURRENCY,
          JSON.stringify(breakdown),
          new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 27, 12)),
        ],
      );
    }

    return { snapshotDates };
  } finally {
    await pool.end();
  }
}

export async function cleanupAnalysisFixture(fixture: AnalysisFixture) {
  const pool = createDbPool();
  try {
    const user = await pool.query<{ id: string }>(`SELECT "id" FROM "User" WHERE "email" = $1`, [
      E2E_EMAIL,
    ]);
    const userId = user.rows[0]?.id;
    if (!userId) return;
    await removeFixtureData(pool, userId, fixture.snapshotDates);
  } finally {
    await pool.end();
  }
}
