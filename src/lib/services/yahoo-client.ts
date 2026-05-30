import "server-only";

// Single configured yahoo-finance2 client shared across every server call site
// (search, price-service, options/chain). Centralizing instantiation keeps
// client config in one place instead of being copy-pasted per route, and reuses
// one instance across requests instead of constructing a fresh one each time.
//
// The dynamic import is deliberate: it keeps yahoo-finance2 (and its Node-only
// deps) out of any module graph that doesn't actually call Yahoo.
async function load() {
  const YahooFinance = (await import("yahoo-finance2")).default;
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
