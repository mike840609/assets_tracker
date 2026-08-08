import "server-only";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getYahooClient, getYahooErrorStatus } from "@/lib/services/yahoo-client";
import { PRICE_REFRESH_TTL_MS } from "@/lib/refresh-policy";
import { log, withTiming } from "@/lib/logger";
import { chunk } from "@/lib/batch";
import type { PriceRefreshOutcome } from "@/lib/price-refresh-contract";

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_500]; // 2 retries: 500 ms then 1.5 s
const CLAIM_LOCK_TTL_MS = 30_000; // dead-instance TTL for refreshingAt claim

// Batching limits. On the cron path the symbol list is the union of every
// user's holdings and watchlist entries, so an unchunked request grows with the
// instance rather than with any one user. Yahoo's `quote` is comfortable with
// ~50 symbols per call; 3 chunks in flight keeps a 250-symbol universe to two
// waves without presenting as a burst. The fallback cap is deliberately lower
// than the number of symbols it replaces: answering one upstream failure with
// one request per symbol is what turns a rate-limit into an outage.
const YAHOO_CHUNK_SIZE = 50;
const YAHOO_CHUNK_CONCURRENCY = 3;
const YAHOO_FALLBACK_CONCURRENCY = 4;

// CoinGecko's free tier rate-limits far more aggressively than Yahoo, so ids
// are chunked mainly to bound the query string and are run only 2 at a time.
const COINGECKO_CHUNK_SIZE = 50;
const COINGECKO_CURRENCY_CHUNK_SIZE = 50;
const COINGECKO_CONCURRENCY = 2;

// Wall-clock budgets. The cron route has a 60 s maxDuration and price refresh is
// only its first step, so neither provider may consume the whole window. The
// guard stops *queueing* work; one already-dispatched request can still run to
// its FETCH_TIMEOUT_MS, which bounds the real ceiling at budget + 5 s.
const YAHOO_BUDGET_MS = 15_000;
const COINGECKO_BUDGET_MS = 8_000;

export type RefreshPricesResult = {
  /** Whether no price work was due, some or all due quotes persisted, or the refresh failed. */
  outcome: PriceRefreshOutcome;
  updated: number;
  /** Persisted rows whose price/currency changed compared with the previous value. */
  changed: number;
  /** Symbols skipped because their cached price was younger than the TTL. */
  skippedFresh: number;
  errors: string[];
  /** When the earliest skipped symbol becomes stale; null unless everything was skipped. */
  nextRefreshAt: string | null;
  retryAfterSeconds: number | null;
};

export type RefreshPricesOptions = {
  /** Bypass the freshness gate (cron path — snapshots need current prices). */
  force?: boolean;
  /** Omit user-controlled identifiers and raw provider errors from logs. */
  redactIdentifiers?: boolean;
};

function redactedErrorMetadata(
  error: unknown,
  metadata: Record<string, string | number> = {},
): Record<string, string | number> {
  const yahooStatus = getYahooErrorStatus(error);
  const messageStatus =
    error instanceof Error ? Number(error.message.match(/\b([45]\d\d)\b/)?.[1]) : Number.NaN;
  const status = yahooStatus ?? (Number.isFinite(messageStatus) ? messageStatus : undefined);
  return {
    ...metadata,
    errorType: error instanceof Error ? error.name : "unknown",
    ...(status !== undefined && { status }),
  };
}

async function withProviderTiming<T>(
  label: string,
  fn: () => Promise<T>,
  metadata: Record<string, string | number>,
  options: { redactIdentifiers?: boolean },
): Promise<T> {
  if (!options.redactIdentifiers) return withTiming(label, fn, metadata);
  const startedAt = Date.now();
  try {
    const result = await fn();
    log.info(label, { ...metadata, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    log.error(
      label,
      redactedErrorMetadata(error, {
        ...metadata,
        durationMs: Date.now() - startedAt,
      }),
    );
    throw error;
  }
}

function decimalChangedAtDbScale(current: unknown, next: number): boolean {
  const currentNumber = Number(current);
  return (
    !Number.isFinite(currentNumber) ||
    !Number.isFinite(next) ||
    currentNumber.toFixed(8) !== next.toFixed(8)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run `worker` over `items` with at most `limit` of them in flight. Per-item
 * rejections are swallowed (the worker owns its own logging) so the pool always
 * drains to the end instead of losing the remaining items to one failure.
 *
 * `shouldStop` is polled before each item is dispatched, so a blown wall-clock
 * budget stops queueing new upstream calls instead of letting a slow tail run on
 * past the caller's deadline.
 */
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      if (shouldStop()) return;
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        // Worker-level concern; never let one item abort the pool.
      }
    }
  });
  await Promise.all(runners);
}

/** Returns a predicate that flips true once `budgetMs` of wall clock has elapsed. */
function deadlineGuard(budgetMs: number): () => boolean {
  const deadline = Date.now() + budgetMs;
  return () => Date.now() >= deadline;
}

/**
 * A rate-limit is the one failure class where retrying is strictly harmful: the
 * ladder re-hits an endpoint that has explicitly told us to back off, and the
 * upstream cool-off outlives our 500 ms / 1.5 s delays by orders of magnitude.
 * Detected both from yahoo-finance2's numeric `code` and from message text, so
 * CoinGecko's `HTTP 429` is covered by the same rule.
 */
function isRateLimited(err: unknown): boolean {
  if (getYahooErrorStatus(err) === 429) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    /\b429\b/.test(err.message) || msg.includes("too many requests") || msg.includes("rate limit")
  );
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Checked before everything below: the 5xx regex would otherwise match a
  // rate-limit message that merely carries a 5xx-looking token (a `Retry-After`
  // hint, an edge-node id), turning one 429 into three.
  if (isRateLimited(err)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("timed out") ||
    /\b5\d\d\b/.test(err.message)
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  shouldStop: () => boolean = () => false,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // `shouldStop` keeps the ladder inside the caller's budget: without it a
      // request dispatched just before the deadline could still add ~17 s of
      // timeouts and backoff on top of it.
      if (attempt < RETRY_DELAYS_MS.length && isRetryable(err) && !shouldStop()) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        if (shouldStop()) break;
      } else {
        break;
      }
    }
  }
  throw lastError;
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  XRP: "ripple",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  ALGO: "algorand",
  FIL: "filecoin",
  NEAR: "near",
  APT: "aptos",
};

// Some exchanges are quoted by Yahoo in a currency's *minor* unit rather than
// its major ISO unit: London (`.L`) trades in pence tagged "GBp" and
// Johannesburg (`.JO`) in cents tagged "ZAc" — each 1/100 of the major unit.
// Stored verbatim, a £0.70 share (7000 "GBp") is later valued as if it were
// £70 (100x overstatement) because no FX provider carries a "GBp"/"ZAc" rate.
// Normalize such quotes to the major unit + ISO code at the single ingest
// chokepoint so every downstream consumer (net worth, analysis, watchlist)
// sees a consistent major-unit price.
//
// Case sensitivity matters: "GBp" (minor) and "GBP" (major) differ only by
// case, so a naive lowercase compare would collapse them. We therefore match
// the pence/cent tokens exactly (case-sensitive), and only the unambiguous
// X-suffixed variants (GBX/ZAX — no major currency uses them) case-insensitively.
const MINOR_UNIT_TO_MAJOR: Record<string, string> = {
  GBp: "GBP",
  ZAc: "ZAR",
};

export function normalizeMinorCurrencyQuote(
  price: number,
  currency: string,
): { price: number; currency: string } {
  let major = MINOR_UNIT_TO_MAJOR[currency];
  if (!major) {
    const upper = currency.toUpperCase();
    if (upper === "GBX") major = "GBP";
    else if (upper === "ZAX") major = "ZAR";
  }
  if (!major) return { price, currency };
  return { price: price / 100, currency: major };
}

async function fetchYahooQuotes(
  symbols: string[],
  providerErrors?: string[],
  options: { redactIdentifiers?: boolean } = {},
): Promise<Map<string, { price: number; currency: string }>> {
  const results = new Map<string, { price: number; currency: string }>();
  if (symbols.length === 0) return results;

  const yahooFinance = await getYahooClient();
  const outOfBudget = deadlineGuard(YAHOO_BUDGET_MS);

  // The timeout is per request, so after chunking it applies per chunk.
  const fetchSymbols = async (syms: string[]) => {
    const quotes = await withRetry(
      () =>
        Promise.race([
          yahooFinance.quote(syms),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Yahoo Finance request timed out")),
              FETCH_TIMEOUT_MS,
            ),
          ),
        ]),
      outOfBudget,
    );
    for (const q of Array.isArray(quotes) ? quotes : [quotes]) {
      if (q?.regularMarketPrice && q.symbol) {
        results.set(
          q.symbol,
          normalizeMinorCurrencyQuote(q.regularMarketPrice, q.currency || "USD"),
        );
      }
    }
  };

  const groups = chunk(symbols, YAHOO_CHUNK_SIZE);

  await withProviderTiming(
    "price.yahoo.fetch",
    () =>
      runPool(
        groups,
        YAHOO_CHUNK_CONCURRENCY,
        async (group) => {
          try {
            await fetchSymbols(group);
          } catch (batchErr) {
            providerErrors?.push(`Yahoo Finance batch failed: ${String(batchErr)}`);
            log.error(
              "price.yahoo.batch_failed",
              options.redactIdentifiers
                ? redactedErrorMetadata(batchErr, {
                    operation: "yahoo-batch",
                    symbolCount: group.length,
                  })
                : { error: String(batchErr), symbolCount: group.length },
            );
            // A rate-limited batch must not fan out into one request per symbol:
            // that would amplify the exact upstream signal telling us to stop.
            if (isRateLimited(batchErr)) return;
            // Isolate bad tickers for *this chunk only*. Falling back over the
            // whole symbol list is what made one failed request fan out to one
            // request per symbol across every user's holdings.
            //
            // A single-symbol chunk is skipped outright: the per-symbol retry
            // would repeat the exact call that just failed.
            if (group.length === 1) return;
            await runPool(
              group,
              YAHOO_FALLBACK_CONCURRENCY,
              async (symbol) => {
                try {
                  await fetchSymbols([symbol]);
                } catch (err) {
                  providerErrors?.push(`Yahoo Finance fallback failed: ${String(err)}`);
                  log.error(
                    "price.yahoo.symbol_failed",
                    options.redactIdentifiers
                      ? redactedErrorMetadata(err, {
                          operation: "yahoo-symbol-fallback",
                          symbolCount: 1,
                        })
                      : { symbol, error: String(err) },
                  );
                }
              },
              outOfBudget,
            );
          }
        },
        outOfBudget,
      ),
    { symbolCount: symbols.length, chunkCount: groups.length },
    options,
  );

  return results;
}

export async function fetchStockPrices(
  symbols: string[],
  providerErrors?: string[],
  options: { redactIdentifiers?: boolean } = {},
): Promise<Map<string, { price: number; currency: string }>> {
  return fetchYahooQuotes(symbols, providerErrors, options);
}

// Strip currency suffix from crypto symbol (e.g. "BTC-USD" -> "BTC")
function stripCurrencySuffix(symbol: string): string {
  return symbol.replace(/-[A-Z]{3,4}$/, "");
}

// Extract the quote-currency suffix from a crypto pair (e.g. "BTC-EUR" -> "EUR").
// Defaults to USD for symbols with no recognizable suffix (e.g. bare "BTC").
function extractQuoteCurrency(symbol: string): string {
  const match = symbol.match(/-([A-Z]{3,4})$/);
  return match ? match[1] : "USD";
}

export async function fetchCryptoPrices(
  symbols: string[],
  providerErrors?: string[],
  options: { redactIdentifiers?: boolean } = {},
): Promise<Map<string, { price: number; currency: string }>> {
  if (symbols.length === 0) return new Map();

  // Primary: Yahoo Finance (handles crypto pairs like BTC-USD)
  const results = await fetchYahooQuotes(symbols, providerErrors, options);

  // Fallback: CoinGecko for any symbols not found via Yahoo Finance
  const missing = symbols.filter((s) => !results.has(s));
  if (missing.length > 0) {
    const symbolMap = missing.map((s) => {
      const base = stripCurrencySuffix(s);
      const geckoId = COINGECKO_IDS[base] || base.toLowerCase();
      // Respect the pair's own quote currency (e.g. BTC-EUR -> "eur") instead
      // of always pricing in USD — CoinGecko's `vs_currencies` supports most
      // major fiat codes, and mismatching this against the pair silently
      // crosses the FX leg at valuation time.
      const quoteCurrency = extractQuoteCurrency(s);
      return { original: s, base, geckoId, quoteCurrency };
    });

    // Deduplicated: several pairs can share one id (BTC-USD and BTC-EUR are both
    // "bitcoin"), and repeating it only inflates the query string.
    const ids = [...new Set(symbolMap.map((s) => s.geckoId).filter(Boolean))];
    const vsCurrencies = [...new Set(symbolMap.map((s) => s.quoteCurrency.toLowerCase()))];
    if (ids.length > 0) {
      const data: Record<string, Record<string, number>> = {};
      const outOfBudget = deadlineGuard(COINGECKO_BUDGET_MS);
      const requests = chunk(ids, COINGECKO_CHUNK_SIZE).flatMap((idGroup) =>
        chunk(vsCurrencies, COINGECKO_CURRENCY_CHUNK_SIZE).map((currencyGroup) => ({
          idGroup,
          currencyGroup,
        })),
      );
      // Chunk both query dimensions so neither a large coin universe nor a
      // large quote-currency set can grow the URL without bound. A request that
      // fails no longer costs the run every other chunk's prices.
      await runPool(
        requests,
        COINGECKO_CONCURRENCY,
        async ({ idGroup, currencyGroup }) => {
          const url = new URL("https://api.coingecko.com/api/v3/simple/price");
          url.searchParams.set("ids", idGroup.join(","));
          url.searchParams.set("vs_currencies", currencyGroup.join(","));
          try {
            const part = await withProviderTiming(
              "price.coingecko.fetch",
              () =>
                withRetry(async () => {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
                  try {
                    const res = await fetch(url, {
                      signal: controller.signal,
                      next: { revalidate: 60, tags: ["prices:crypto"] },
                    } as RequestInit);
                    if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);
                    return res.json() as Promise<Record<string, Record<string, number>>>;
                  } finally {
                    clearTimeout(timeoutId);
                  }
                }, outOfBudget),
              { idCount: idGroup.length, currencyCount: currencyGroup.length },
              options,
            );
            for (const [id, prices] of Object.entries(part)) {
              data[id] = { ...data[id], ...prices };
            }
          } catch (error) {
            providerErrors?.push(`CoinGecko fetch failed: ${String(error)}`);
            log.error(
              "price.coingecko.failed",
              options.redactIdentifiers
                ? redactedErrorMetadata(error, {
                    operation: "coingecko-batch",
                    symbolCount: idGroup.length,
                  })
                : { error: String(error) },
            );
          }
        },
        outOfBudget,
      );
      for (const { original, geckoId, quoteCurrency } of symbolMap) {
        const price = data[geckoId]?.[quoteCurrency.toLowerCase()];
        if (price) {
          results.set(original, { price, currency: quoteCurrency });
        }
      }
    }
  }

  return results;
}

// `getCachedPricesForSymbols` used to live here. It read the ENTIRE PriceCache
// — every symbol of every user on the instance — and filtered down to one
// user's holdings in JS, behind a cache entry tagged `prices`. That is the most
// frequently invalidated tag in the codebase (every holding write, watchlist
// add, manual refresh and cron run busts it, globally for all users), so the
// full-table read re-ran on close to every /accounts render (#643).
//
// Its single caller now uses `account-service.getAccountPriceMap`, which was
// already doing the scoped `symbol IN (...)` lookup for /accounts/[id] — the
// same shape net-worth-service and stock-watch-service use. There is no reason
// for a second way to read prices by symbol.

export async function refreshAllPrices(): Promise<RefreshPricesResult> {
  const [holdings, trackedStocks] = await Promise.all([
    prisma.holding.findMany({
      where: { account: { user: { demoWorkspace: null } } },
      select: { symbol: true, assetType: true },
      distinct: ["symbol"],
    }),
    prisma.stockWatchItem.findMany({
      where: { user: { demoWorkspace: null } },
      select: { symbol: true },
      distinct: ["symbol"],
    }),
  ]);

  const holdingKeys = new Set(holdings.map((holding) => holding.symbol));
  const stockWatchHoldings = trackedStocks
    .filter((stock) => !holdingKeys.has(stock.symbol))
    .map((stock) => ({ symbol: stock.symbol, assetType: "STOCK" }));

  return refreshPricesForHoldings([...holdings, ...stockWatchHoldings], { force: true });
}

export async function refreshPricesForUser(
  userId: string,
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  const [holdings, trackedStocks] = await Promise.all([
    prisma.holding.findMany({
      where: { account: { userId } },
      select: { symbol: true, assetType: true },
      distinct: ["symbol"],
    }),
    prisma.stockWatchItem.findMany({
      where: { userId },
      select: { symbol: true },
      distinct: ["symbol"],
    }),
  ]);

  const holdingKeys = new Set(holdings.map((holding) => holding.symbol));
  const stockWatchHoldings = trackedStocks
    .filter((stock) => !holdingKeys.has(stock.symbol))
    .map((stock) => ({ symbol: stock.symbol, assetType: "STOCK" }));

  return refreshPricesForHoldings([...holdings, ...stockWatchHoldings], opts);
}

export async function refreshPricesForStockSymbols(
  symbols: string[],
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  if (uniqueSymbols.length === 0) {
    return {
      outcome: "no_due_symbols",
      updated: 0,
      changed: 0,
      skippedFresh: 0,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }
  return refreshPricesForHoldings(
    uniqueSymbols.map((symbol) => ({ symbol, assetType: "STOCK" })),
    opts,
  );
}

async function releaseClaims(symbols: string[], options: RefreshPricesOptions = {}): Promise<void> {
  if (symbols.length === 0) return;
  const placeholders = symbols.map((_, i) => `$${i + 1}`).join(", ");
  await prisma
    .$executeRawUnsafe(
      `UPDATE "PriceCache" SET "refreshingAt" = NULL WHERE symbol IN (${placeholders})`,
      ...symbols,
    )
    .catch((err) => {
      log.error(
        "price.refresh.claim_cleanup_failed",
        options.redactIdentifiers
          ? redactedErrorMetadata(err, {
              operation: "claim-cleanup",
              symbolCount: symbols.length,
            })
          : { error: String(err) },
      );
    });
}

async function refreshPricesForHoldings(
  holdings: { symbol: string; assetType: string }[],
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  if (holdings.length === 0) {
    return {
      outcome: "no_due_symbols",
      updated: 0,
      changed: 0,
      skippedFresh: 0,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  let skippedFresh = 0;
  let earliestFreshUpdatedAt: Date | null = null;
  let claimedSymbols: string[] = [];

  if (!opts.force) {
    // Single query: load all existing PriceCache rows for these symbols so we
    // can derive fresh / stale-existing / stale-new in one round-trip.
    const existingRows = await prisma.priceCache.findMany({
      where: { symbol: { in: holdings.map((h) => h.symbol) } },
      select: { symbol: true, updatedAt: true },
    });

    const freshThreshold = new Date(Date.now() - PRICE_REFRESH_TTL_MS);
    const freshSymbols = new Set<string>();
    const existingSymbols = new Set<string>();

    for (const row of existingRows) {
      existingSymbols.add(row.symbol);
      if (row.updatedAt >= freshThreshold) {
        freshSymbols.add(row.symbol);
        if (!earliestFreshUpdatedAt || row.updatedAt < earliestFreshUpdatedAt) {
          earliestFreshUpdatedAt = row.updatedAt;
        }
      }
    }

    skippedFresh = freshSymbols.size;
    if (skippedFresh > 0) {
      log.info("price.refresh.skipped_fresh", { count: skippedFresh });
    }

    holdings = holdings.filter((h) => !freshSymbols.has(h.symbol));

    if (holdings.length === 0) {
      const nextRefreshAt = earliestFreshUpdatedAt
        ? new Date(earliestFreshUpdatedAt.getTime() + PRICE_REFRESH_TTL_MS)
        : null;
      return {
        outcome: "no_due_symbols",
        updated: 0,
        changed: 0,
        skippedFresh,
        errors: [],
        nextRefreshAt: nextRefreshAt?.toISOString() ?? null,
        retryAfterSeconds: nextRefreshAt
          ? Math.max(1, Math.ceil((nextRefreshAt.getTime() - Date.now()) / 1000))
          : null,
      };
    }

    // Split stale symbols: existing rows can be claimed; new symbols bypass the claim.
    const staleExisting = holdings
      .filter((h) => existingSymbols.has(h.symbol))
      .map((h) => h.symbol);
    const staleNew = holdings.filter((h) => !existingSymbols.has(h.symbol));

    if (staleExisting.length > 0) {
      // Atomic claim: set refreshingAt = NOW() only for symbols that are stale
      // and not currently being refreshed (or whose claim has expired after 30s).
      // $1 = lockCutoff (refreshingAt expiry), $2 = freshThreshold (updatedAt gate),
      // $3...$N = symbol values — all positional, no string interpolation of values.
      const lockCutoff = new Date(Date.now() - CLAIM_LOCK_TTL_MS);
      const symbolPlaceholders = staleExisting.map((_, i) => `$${i + 3}`).join(", ");
      const claimed = await prisma.$queryRawUnsafe<{ symbol: string }[]>(
        `UPDATE "PriceCache"
         SET "refreshingAt" = NOW()
         WHERE symbol IN (${symbolPlaceholders})
           AND ("refreshingAt" IS NULL OR "refreshingAt" < $1)
           AND "updatedAt" < $2
         RETURNING symbol`,
        lockCutoff,
        freshThreshold,
        ...staleExisting,
      );
      claimedSymbols = claimed.map((r) => r.symbol);
    }

    if (claimedSymbols.length === 0 && staleNew.length === 0) {
      // All existing stale symbols are being refreshed by another instance.
      // Tell the client when the claim lock expires so it knows when to retry.
      return {
        outcome: "deferred",
        updated: 0,
        changed: 0,
        skippedFresh,
        errors: [],
        nextRefreshAt: null,
        retryAfterSeconds: Math.ceil(CLAIM_LOCK_TTL_MS / 1000),
      };
    }

    // Narrow holdings to only the symbols this instance will fetch.
    const fetchable = new Set([...claimedSymbols, ...staleNew.map((h) => h.symbol)]);
    holdings = holdings.filter((h) => fetchable.has(h.symbol));
  }

  const stockSymbols = holdings
    .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND", "OPTION"].includes(h.assetType))
    .map((h) => h.symbol);

  const cryptoSymbols = holdings.filter((h) => h.assetType === "CRYPTO").map((h) => h.symbol);
  const supportedDueSymbols = new Set([...stockSymbols, ...cryptoSymbols]);

  // OTHER holdings intentionally have no market-data provider. They are not a
  // failed refresh target; release any stale-row claim and preserve the normal
  // no-work success semantics.
  if (supportedDueSymbols.size === 0) {
    await releaseClaims(claimedSymbols, opts);
    return {
      outcome: "no_due_symbols",
      updated: 0,
      changed: 0,
      skippedFresh,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  const errors: string[] = [];
  let updated = 0;
  let changed = 0;

  const [stockResult, cryptoResult] = await Promise.allSettled([
    fetchStockPrices(stockSymbols, errors, opts),
    fetchCryptoPrices(cryptoSymbols, errors, opts),
  ]);
  const stockPrices =
    stockResult.status === "fulfilled"
      ? stockResult.value
      : new Map<string, { price: number; currency: string }>();
  const cryptoPrices =
    cryptoResult.status === "fulfilled"
      ? cryptoResult.value
      : new Map<string, { price: number; currency: string }>();
  if (stockResult.status === "rejected") {
    errors.push(`Stock price fetch failed: ${String(stockResult.reason)}`);
  }
  if (cryptoResult.status === "rejected") {
    errors.push(`Crypto price fetch failed: ${String(cryptoResult.reason)}`);
  }

  const allPrices = new Map([...stockPrices, ...cryptoPrices]);

  const entries = [...allPrices].filter(([symbol]) => supportedDueSymbols.has(symbol));
  if (entries.length === 0) {
    // No prices came back (all fetches failed). Release claims so the next
    // request can retry rather than waiting for the 30s dead-instance TTL.
    await releaseClaims(claimedSymbols, opts);
    if (errors.length === 0) {
      errors.push(`No usable prices returned for ${supportedDueSymbols.size} due symbols`);
    }
    return {
      outcome: "total_failure",
      updated: 0,
      changed: 0,
      skippedFresh,
      errors,
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  let bulkUpsertFailed = false;
  try {
    const currentRows = await prisma.priceCache.findMany({
      where: { symbol: { in: entries.map(([symbol]) => symbol) } },
      select: { symbol: true, price: true, currency: true },
    });
    const currentBySymbol = new Map(currentRows.map((row) => [row.symbol, row]));
    const pendingChanged = entries.reduce((count, [symbol, { price, currency }]) => {
      const current = currentBySymbol.get(symbol);
      return current === undefined ||
        current.currency !== currency ||
        decimalChangedAtDbScale(current.price, price)
        ? count + 1
        : count;
    }, 0);

    const params: unknown[] = [];
    const placeholders = entries.map(([symbol, { price, currency }]) => {
      const base = params.length;
      params.push(symbol, String(price), currency);
      return `($${base + 1}, $${base + 2}::numeric, $${base + 3}, NOW())`;
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PriceCache" (symbol, price, currency, "updatedAt")
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (symbol) DO UPDATE SET
         price          = EXCLUDED.price,
         currency       = EXCLUDED.currency,
         "updatedAt"    = NOW(),
         "refreshingAt" = NULL`,
      ...params,
    );
    updated = entries.length;
    changed = pendingChanged;
  } catch (error) {
    bulkUpsertFailed = true;
    errors.push(`Bulk upsert failed: ${String(error)}`);
    // Release claims so the next request can retry immediately.
    await releaseClaims(claimedSymbols, opts);
  }

  if (!bulkUpsertFailed) {
    // Cache invalidation happens after the write boundary: a cache-provider
    // failure cannot turn already-persisted prices into a total refresh failure.
    if (changed > 0) {
      try {
        revalidateTag("prices", "max");
      } catch (error) {
        log.error(
          "price.refresh.revalidate_failed",
          opts.redactIdentifiers
            ? redactedErrorMetadata(error, { operation: "cache-revalidation" })
            : { error: String(error) },
        );
      }
    }

    // Partial fetch: symbols we claimed but got no price for (bad/transient
    // ticker) keep their refreshingAt set by the upsert (it only clears rows it
    // touched). Release them so a retry isn't blocked for the full 30s TTL.
    const fetchedSet = new Set(entries.map(([symbol]) => symbol));
    await releaseClaims(
      claimedSymbols.filter((symbol) => !fetchedSet.has(symbol)),
      opts,
    );
  }

  return {
    outcome: bulkUpsertFailed
      ? "total_failure"
      : entries.length < supportedDueSymbols.size
        ? "partial_success"
        : "success",
    updated,
    changed,
    skippedFresh,
    errors,
    nextRefreshAt: null,
    retryAfterSeconds: null,
  };
}
