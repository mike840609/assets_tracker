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

export async function GET(request: Request) {
  const limited = rateLimitCheckWithPrune(request, { limit: 30, prefix: "options-chain" });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return ok(EMPTY);

  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yf = new YahooFinance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initial: any = await yf.options(symbol);
    const expirationDates: Date[] = initial.expirationDates ?? [];
    const expirations = expirationDates.map((d) =>
      new Date(d).toISOString().slice(0, 10),
    );

    const chains: ChainResponse["chains"] = {};
    const targets = expirationDates.slice(0, 6);
    const detailed = await Promise.all(
      targets.map(async (date) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail: any = await yf.options(symbol, { date });
          return { date, detail };
        } catch (err) {
          console.error(`Options chain fetch failed for ${symbol} ${date}:`, err);
          return null;
        }
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slim = (arr: any[] | undefined): ChainContract[] =>
      (arr ?? []).map((c) => ({
        contractSymbol: c.contractSymbol,
        strike: Number(c.strike),
        lastPrice: c.lastPrice ?? null,
        bid: c.bid ?? null,
        ask: c.ask ?? null,
      }));

    for (const item of detailed) {
      if (!item) continue;
      const exp = new Date(item.date).toISOString().slice(0, 10);
      const block = item.detail.options?.[0];
      if (!block) continue;
      chains[exp] = {
        calls: slim(block.calls),
        puts: slim(block.puts),
      };
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
