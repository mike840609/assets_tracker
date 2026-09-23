import { describe, expect, it } from "vitest";
import { buildOccSymbol, groupHoldingsByUnderlying } from "@/lib/options";

type H = {
  id: string;
  symbol: string;
  assetType: "STOCK" | "OPTION";
  underlyingSymbol: string | null;
  marketValue: number | null;
};

const soon = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 15));
const later = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 5, 18));

function stock(symbol: string, marketValue: number | null = 100): H {
  return { id: symbol, symbol, assetType: "STOCK", underlyingSymbol: null, marketValue };
}

function option(
  underlying: string,
  optionType: "CALL" | "PUT",
  strike: number,
  expiration = soon,
  marketValue: number | null = 10,
): H {
  const symbol = buildOccSymbol({ underlying, expiration, optionType, strike });
  return { id: symbol, symbol, assetType: "OPTION", underlyingSymbol: underlying, marketValue };
}

const ids = (items: ReturnType<typeof groupHoldingsByUnderlying<H>>) =>
  items.map((i) => (i.kind === "single" ? i.holding.id : `group:${i.underlying}`));

describe("groupHoldingsByUnderlying", () => {
  it("groups a stock with its calls and puts, stock first", () => {
    const call = option("AAPL", "CALL", 150);
    const put = option("AAPL", "PUT", 140);
    const result = groupHoldingsByUnderlying([put, stock("VOO"), call, stock("AAPL")]);

    expect(ids(result)).toEqual(["group:AAPL", "VOO"]);
    const group = result[0];
    expect(group.kind).toBe("group");
    if (group.kind !== "group") return;
    expect(group.holdings.map((h) => h.id)).toEqual(["AAPL", put.id, call.id]);
    expect(group.marketValue).toBe(120);
  });

  it("groups options on the same underlying even without the stock", () => {
    const result = groupHoldingsByUnderlying([
      option("TSLA", "CALL", 300),
      option("TSLA", "PUT", 200),
    ]);
    expect(ids(result)).toEqual(["group:TSLA"]);
  });

  it("leaves a lone stock and a lone option ungrouped", () => {
    const lone = option("NVDA", "CALL", 100);
    const result = groupHoldingsByUnderlying([stock("MSFT"), lone]);
    expect(ids(result)).toEqual(["MSFT", lone.id]);
  });

  it("does not group stock-only holdings", () => {
    const result = groupHoldingsByUnderlying([stock("AAPL"), stock("VOO")]);
    expect(result.every((i) => i.kind === "single")).toBe(true);
  });

  it("orders options by expiration, then strike, then call before put", () => {
    const a = option("SPY", "PUT", 500, later);
    const b = option("SPY", "PUT", 450, soon);
    const c = option("SPY", "CALL", 450, soon);
    const d = option("SPY", "CALL", 400, soon);
    const [group] = groupHoldingsByUnderlying([a, b, c, d]);
    if (group.kind !== "group") throw new Error("expected group");
    expect(group.holdings.map((h) => h.id)).toEqual([d.id, c.id, b.id, a.id]);
  });

  it("falls back to the OCC root when underlyingSymbol is missing", () => {
    const call = { ...option("AMD", "CALL", 150), underlyingSymbol: null };
    const result = groupHoldingsByUnderlying([stock("AMD"), call]);
    expect(ids(result)).toEqual(["group:AMD"]);
  });

  it("keeps an unparseable option symbol as its own row", () => {
    const weird: H = {
      id: "weird",
      symbol: "NOT-AN-OCC",
      assetType: "OPTION",
      underlyingSymbol: null,
      marketValue: 5,
    };
    const result = groupHoldingsByUnderlying([stock("AAPL"), weird]);
    expect(ids(result)).toEqual(["AAPL", "weird"]);
  });

  it("places a group at its first member's position when not sorting by value", () => {
    const result = groupHoldingsByUnderlying([
      stock("MSFT"),
      option("AAPL", "CALL", 150),
      stock("VOO"),
      stock("AAPL"),
    ]);
    expect(ids(result)).toEqual(["MSFT", "group:AAPL", "VOO"]);
  });

  it("re-sorts by combined value when sorting by value", () => {
    const items = [
      stock("VOO", 300),
      stock("AAPL", 200),
      option("AAPL", "CALL", 150, soon, 150),
      stock("MSFT", 250),
    ];
    expect(ids(groupHoldingsByUnderlying(items, "desc"))).toEqual(["group:AAPL", "VOO", "MSFT"]);
    expect(ids(groupHoldingsByUnderlying(items, "asc"))).toEqual(["MSFT", "VOO", "group:AAPL"]);
  });

  it("matches the flat sort's value rules: null as 0, negative totals, stable ties", () => {
    const unpriced = stock("MSFT", null);
    const b = stock("VOO", 20);
    const c = stock("QQQ", 20);
    const shortCall = option("AAPL", "CALL", 150, soon, -60);
    const aapl = stock("AAPL", 10);

    // Inputs arrive already sorted by the page's flat value sort.
    const desc = groupHoldingsByUnderlying([b, c, aapl, unpriced, shortCall], "desc");
    expect(ids(desc)).toEqual(["VOO", "QQQ", "MSFT", "group:AAPL"]);
    const asc = groupHoldingsByUnderlying([shortCall, unpriced, aapl, b, c], "asc");
    expect(ids(asc)).toEqual(["group:AAPL", "MSFT", "VOO", "QQQ"]);
  });

  it("groups an unparseable option that has underlyingSymbol, sorted after parsed options", () => {
    const expired: H = {
      id: "expired",
      symbol: "AAPL200117C00150000",
      assetType: "OPTION",
      underlyingSymbol: "AAPL",
      marketValue: 0,
    };
    const call = option("AAPL", "CALL", 150);
    const [group] = groupHoldingsByUnderlying([expired, call, stock("AAPL")]);
    if (group.kind !== "group") throw new Error("expected group");
    expect(group.holdings.map((h) => h.id)).toEqual(["AAPL", call.id, "expired"]);
  });

  it("matches a lowercase underlyingSymbol to the upper-case stock", () => {
    const call = { ...option("AAPL", "CALL", 150), underlyingSymbol: "aapl" };
    expect(ids(groupHoldingsByUnderlying([stock("AAPL"), call]))).toEqual(["group:AAPL"]);
  });

  it("reports a null group value only when every member is unpriced", () => {
    const [allNull] = groupHoldingsByUnderlying([
      option("QQQ", "CALL", 400, soon, null),
      option("QQQ", "PUT", 400, soon, null),
    ]);
    const [partial] = groupHoldingsByUnderlying([
      option("IWM", "CALL", 200, soon, null),
      option("IWM", "PUT", 200, soon, 7),
    ]);
    expect(allNull.kind === "group" && allNull.marketValue).toBeNull();
    expect(partial.kind === "group" && partial.marketValue).toBe(7);
  });

  it("returns an empty list for no holdings", () => {
    expect(groupHoldingsByUnderlying([])).toEqual([]);
  });
});
