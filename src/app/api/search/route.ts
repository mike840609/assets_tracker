import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yahooFinance.search(query, {
      quotesCount: 10,
      newsCount: 0,
    });

    const quotes: SearchResult[] = (result.quotes || [])
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
      }));

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json([]);
  }
}
