import { describe, it, expect } from "vitest";
import {
  compareTransactionsDesc,
  isBackdated,
  effectiveTransactionTime,
  formatTransactionDateKey,
} from "@/lib/transaction-dates";

// The account ledger shows cash rows on their effective date
// (occurrenceDate ?? createdAt) — the same fallback the analysis pipeline
// uses since PR #499 — so a backdated entry surfaces on its real day (#500).

describe("effectiveTransactionTime", () => {
  it("prefers occurrenceDate over createdAt", () => {
    const tx = {
      id: "a",
      createdAt: "2026-07-03T14:32:00.000Z",
      occurrenceDate: "2026-06-01T00:00:00.000Z",
    };
    expect(effectiveTransactionTime(tx)).toBe(Date.parse("2026-06-01T00:00:00.000Z"));
  });

  it("falls back to createdAt when occurrenceDate is null or missing", () => {
    expect(
      effectiveTransactionTime({
        id: "a",
        createdAt: "2026-07-03T14:32:00.000Z",
        occurrenceDate: null,
      }),
    ).toBe(Date.parse("2026-07-03T14:32:00.000Z"));
    expect(effectiveTransactionTime({ id: "a", createdAt: "2026-07-03T14:32:00.000Z" })).toBe(
      Date.parse("2026-07-03T14:32:00.000Z"),
    );
  });
});

describe("compareTransactionsDesc", () => {
  it("moves a backdated entry behind newer effective dates", () => {
    const backdated = {
      id: "new-entry",
      createdAt: "2026-07-03T10:00:00.000Z",
      occurrenceDate: "2026-03-01T00:00:00.000Z",
    };
    const older = { id: "older", createdAt: "2026-07-01T09:00:00.000Z", occurrenceDate: null };
    const sorted = [backdated, older].sort(compareTransactionsDesc);
    expect(sorted.map((t) => t.id)).toEqual(["older", "new-entry"]);
  });

  it("breaks effective-date ties by createdAt then id, newest first", () => {
    const a = { id: "a", createdAt: "2026-07-01T09:00:00.000Z" };
    const b = { id: "b", createdAt: "2026-07-01T12:00:00.000Z" };
    const c = { id: "c", createdAt: "2026-07-01T12:00:00.000Z" };
    expect([a, b, c].sort(compareTransactionsDesc).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });
});

describe("formatTransactionDateKey", () => {
  it("formats an occurrenceDate in UTC so the calendar day never shifts", () => {
    // UTC midnight would render as the previous day in any UTC-negative zone
    // if formatted in local time; pinning to UTC keeps the stored day.
    const tx = {
      id: "a",
      createdAt: "2026-07-03T14:32:00.000Z",
      occurrenceDate: "2026-06-01T00:00:00.000Z",
    };
    expect(formatTransactionDateKey(tx, "en-US")).toBe("Jun 1, 2026");
  });

  it("uses createdAt when there is no occurrenceDate", () => {
    const tx = { id: "a", createdAt: "2026-07-03T12:00:00.000Z", occurrenceDate: null };
    const expected = new Date(tx.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(formatTransactionDateKey(tx, "en-US")).toBe(expected);
  });
});

describe("isBackdated", () => {
  const now = new Date(2026, 6, 20, 12, 0); // 2026-07-20 local noon

  it("true for a date before local today", () => {
    expect(isBackdated("2026-07-19", now)).toBe(true);
    expect(isBackdated("2025-12-31", now)).toBe(true);
  });

  it("false for today, future, and empty input", () => {
    expect(isBackdated("2026-07-20", now)).toBe(false);
    expect(isBackdated("2026-07-21", now)).toBe(false);
    expect(isBackdated("", now)).toBe(false);
  });
});
