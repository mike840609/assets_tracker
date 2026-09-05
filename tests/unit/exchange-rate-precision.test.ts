import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");

const MIGRATION = "prisma/migrations/20260902000000_widen_exchange_rate_scale/migration.sql";

describe("ExchangeRate.rate precision", () => {
  it("stores rates at a scale that survives inverting a very weak currency", () => {
    // 1/89500 (LBP per USD) needs far more than 8 decimals: at Decimal(18, 8)
    // it rounds to 0.00001117, ~0.3% off, and resolveRate prefers that direct
    // row over re-deriving the inverse.
    const model = schema.match(/model ExchangeRate \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(model).toContain("@db.Decimal(28, 16)");
  });

  it("ships a migration that only widens that one column", () => {
    const migration = readFileSync(resolve(root, MIGRATION), "utf8");
    expect(migration).toMatch(
      /ALTER TABLE "ExchangeRate"\s+ALTER COLUMN "rate" TYPE DECIMAL\(28, ?16\)/,
    );
    // The remaining money columns are widened separately; this migration must
    // not touch them.
    expect(migration).not.toContain('ALTER TABLE "Account"');
    expect(migration).not.toContain('ALTER TABLE "Holding"');
    expect(migration).not.toContain('ALTER TABLE "NetWorthSnapshot"');
  });
});
