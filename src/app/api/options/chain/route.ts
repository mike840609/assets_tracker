import { ok } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

type ChainContract = {
  contractSymbol: string;
  strike: number;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
};

type ChainResponse = {
  underlying: string;
  expirations: string[];
  chains: Record<string, { calls: ChainContract[]; puts: ChainContract[] }>;
};

const EMPTY: ChainResponse = { underlying: "", expirations: [], chains: {} };
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slim = (arr: any[] | undefined): ChainContract[] =>
  (arr ?? []).map((c) => ({
    contractSymbol: c.contractSymbol,
    strike: Number(c.strike),
    lastPrice: c.lastPrice ?? null,
    bid: c.bid ?? null,
    ask: c.ask ?? null,
  }));

export async function GET(request: Request) {
  const limited = rateLimitCheckWithPrune(request, { limit: 60, prefix: "options-chain" });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return ok(EMPTY);

  // Optional: fetch chain for a specific expiration (lazy-loading from the UI)
  const dateParam = searchParams.get("date"); // YYYY-MM-DD

  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yf = new YahooFinance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initial: any = await yf.options(symbol);
    const allDates: Date[] = initial.expirationDates ?? [];

    // Filter to expirations within 2 years
    const cutoff = new Date(Date.now() + TWO_YEARS_MS);
    const targetDates = allDates.filter((d) => new Date(d) <= cutoff);
    const expirations = targetDates.map((d) => new Date(d).toISOString().slice(0, 10));

    const chains: ChainResponse["chains"] = {};

    if (dateParam && expirations.includes(dateParam)) {
      // On-demand fetch for a specific expiration chosen by the user
      const date = targetDates.find((d) => new Date(d).toISOString().slice(0, 10) === dateParam);
      if (date) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail: any = await yf.options(symbol, { date });
          const block = detail.options?.[0];
          if (block) {
            chains[dateParam] = { calls: slim(block.calls), puts: slim(block.puts) };
          }
        } catch (err) {
          console.error(`Options chain fetch failed for ${symbol} ${dateParam}:`, err);
        }
      }
    } else {
      // Initial load: use the chain that comes free in the initial call (nearest expiration)
      for (const opt of initial.options ?? []) {
        if (!opt?.expirationDate) continue;
        const exp = new Date(opt.expirationDate).toISOString().slice(0, 10);
        if (expirations.includes(exp)) {
          chains[exp] = { calls: slim(opt.calls), puts: slim(opt.puts) };
        }
      }
    }

    return ok<ChainResponse>(
      { underlying: symbol, expirations, chains },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    console.error(`Options chain fetch failed for ${symbol}:`, error);
    return ok({ ...EMPTY, underlying: symbol });
  }
}
