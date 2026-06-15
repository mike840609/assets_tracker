import { unstable_cache } from "next/cache";
import { ok, failure } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { getYahooClient, getYahooErrorStatus } from "@/lib/services/yahoo-client";
import { log } from "@/lib/logger";

type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
};

// Map Yahoo Finance quoteType to our HoldingAssetType
function mapQuoteType(quoteType: string): string {
  switch (quoteType) {
    case "EQUITY":
      return "STOCK";
    case "ETF":
      return "ETF";
    case "CRYPTOCURRENCY":
      return "CRYPTO";
    case "MUTUALFUND":
      return "MUTUAL_FUND";
    default:
      return "OTHER";
  }
}

// Infer currency from exchange suffix
function inferCurrency(symbol: string, exchange: string): string {
  if (symbol.endsWith(".TW") || symbol.endsWith(".TWO")) return "TWD";
  if (symbol.endsWith(".HK")) return "HKD";
  if (symbol.endsWith(".L")) return "GBP";
  if (symbol.endsWith(".T")) return "JPY";
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) return "KRW";

  const exchangeCurrencyMap: Record<string, string> = {
    NMS: "USD",
    NYQ: "USD",
    NGM: "USD",
    NCM: "USD",
    PCX: "USD",
    ASE: "USD",
    TAI: "TWD",
    TWO: "TWD",
    HKG: "HKD",
    TYO: "JPY",
    LSE: "GBP",
    KSC: "KRW",
    KOE: "KRW",
    SHH: "CNY",
    SHZ: "CNY",
    FRA: "EUR",
    GER: "EUR",
    PAR: "EUR",
    AMS: "EUR",
    ASX: "AUD",
    TSE: "CAD",
    CNQ: "CAD",
    SES: "SGD",
    BKK: "THB",
    SAO: "BRL",
    BMV: "MXN",
    OSL: "NOK",
    STO: "SEK",
    CPH: "DKK",
    NZE: "NZD",
    NSI: "INR",
    BOM: "INR",
  };

  return exchangeCurrencyMap[exchange] || "USD";
}

function rankResult(r: SearchResult): number {
  if (r.symbol.endsWith(".TW") || r.symbol.endsWith(".TWO")) return 0;
  if (r.currency === "USD") return 1;
  return 2;
}

// NOTE: this intentionally does NOT swallow errors. A thrown error (Yahoo down,
// network failure) must propagate so the handler can return a non-200 and the
// caller can tell "search is broken" apart from "no matches". Errors also aren't
// cached by unstable_cache, so a transient blip won't be pinned for an hour.
const cachedYahooSearch = unstable_cache(
  async (query: string): Promise<SearchResult[]> => {
    const yahooFinance = await getYahooClient();
    // `validateResult: false` skips yahoo-finance2's strict schema validation.
    // Yahoo periodically tweaks its search response shape (e.g. returning
    // `typeDisp: "Equity"` where the lib's schema expects a lowercase const),
    // which otherwise throws FailedYahooValidationError and makes search return
    // zero results. The fields we read below are still present and coerced.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yahooFinance.search(
      query,
      {
        quotesCount: 10,
        newsCount: 0,
      },
      { validateResult: false },
    );

    return (result.quotes || [])
      .filter((q: Record<string, unknown>) => {
        const qt = q.quoteType as string | undefined;
        return qt && ["EQUITY", "ETF", "CRYPTOCURRENCY", "MUTUALFUND"].includes(qt);
      })
      .map((q: Record<string, unknown>) => ({
        symbol: q.symbol as string,
        name: (q.longname as string) || (q.shortname as string) || (q.symbol as string),
        exchange: (q.exchDisp as string) || (q.exchange as string) || "",
        type: mapQuoteType(q.quoteType as string),
        currency: inferCurrency(q.symbol as string, (q.exchange as string) || ""),
      }))
      .sort((a: SearchResult, b: SearchResult) => rankResult(a) - rankResult(b));
  },
  ["yahoo-search"],
  { revalidate: 3600 },
);

export async function GET(request: Request) {
  const limited = rateLimitCheckWithPrune(request, { limit: 60, prefix: "search" });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  // Normalize to lowercase so the cache key is case-insensitive: "AAPL", "aapl",
  // and "Aapl" collapse to one cache entry. Yahoo's search is already
  // case-insensitive, so this doesn't change which results come back.
  const query = searchParams.get("q")?.trim().toLowerCase();

  if (!query || query.length < 1) {
    return ok([] as SearchResult[]);
  }

  try {
    const results = await cachedYahooSearch(query);
    return ok(results, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const status = getYahooErrorStatus(error);
    if (status !== undefined && status >= 400 && status < 500) {
      // Expected client-driven 4xx, not a server fault: a malformed query
      // (e.g. mid-composition Bopomofo yielding a 400 "Invalid Search Query")
      // or a transient upstream rate-limit (429). Keep it out of Sentry —
      // log.warn is breadcrumb-only — and return empty results so the UI shows
      // "no matches" rather than an error. Not cached: a 429 is transient.
      log.warn("search.yahoo_4xx", { query, status, error: String(error) });
      return ok([] as SearchResult[]);
    }
    // Genuine upstream failure (5xx / network / timeout): distinct from an
    // empty 200 so the client can show "search unavailable" instead of a
    // misleading "no results". Captured so real outages stay visible.
    log.error("search.failed", { query, error: String(error) });
    return failure("Search is temporarily unavailable. Please try again.", 502);
  }
}
