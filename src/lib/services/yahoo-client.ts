import "server-only";

// Single configured yahoo-finance2 client shared across every server call site
// (search, price-service, options/chain). Centralizing instantiation keeps
// client config in one place instead of being copy-pasted per route, and reuses
// one instance across requests instead of constructing a fresh one each time.
//
// The dynamic import is deliberate: it keeps yahoo-finance2 (and its Node-only
// deps) out of any module graph that doesn't actually call Yahoo.
// Deterministic offline stub for the local/CI smoke e2e suite. Yahoo rate-limits
// GitHub runner IPs unpredictably ("Failed to get crumb", 429), which made
// POST /api/stocks — and any other server-side quote — a latent flake. The env
// gate is only set by playwright.config.ts (local webServer) and e2e.yml (CI);
// production and Vercel preview deployments never see it.
// ponytail: quote + search only — options/chart aren't exercised by the smoke
// suite; extend the stub if a spec ever hits them.
function stubQuote(symbol: string) {
  const upper = symbol.toUpperCase();
  return {
    symbol: upper,
    quoteType: "EQUITY",
    regularMarketPrice: 200,
    currency: "USD",
    longName: `${upper} Test Co.`,
    shortName: upper,
    exchange: "E2E",
    fullExchangeName: "E2E Exchange",
  };
}

function createE2eStubClient() {
  return {
    quote: async (q: string | string[]) => (Array.isArray(q) ? q.map(stubQuote) : stubQuote(q)),
    search: async (query: string) => ({
      quotes: [
        {
          ...stubQuote(query),
          longname: `${query.toUpperCase()} Test Co.`,
          shortname: query.toUpperCase(),
          exchDisp: "E2E Exchange",
        },
      ],
    }),
  };
}

async function load() {
  const YahooFinance = (await import("yahoo-finance2")).default;
  if (process.env.E2E_YAHOO_STUB === "1") {
    return createE2eStubClient() as unknown as InstanceType<typeof YahooFinance>;
  }
  return new YahooFinance({
    // Informational console notices from the lib (not errors) — quiet them so
    // server logs aren't polluted on every cron/price/search run.
    suppressNotices: ["yahooSurvey", "ripHistorical"],
  });
}

let clientPromise: ReturnType<typeof load> | null = null;

/** Lazily instantiate (once) and return the shared YahooFinance client. */
export function getYahooClient() {
  return (clientPromise ??= load());
}

/**
 * Extract the upstream HTTP status from a yahoo-finance2 error, when it carries
 * one. `BadRequestError` corresponds to a 400; `HTTPError` sets a numeric `code`
 * to the response status (see the lib's yahooFinanceFetch). Returns undefined
 * for network/timeout/validation errors that have no HTTP status — callers
 * should treat those as genuine failures. Lets call sites distinguish an
 * expected client-driven 4xx (malformed query, rate-limit) from a real outage.
 */
export function getYahooErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.name === "BadRequestError") return 400;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}
