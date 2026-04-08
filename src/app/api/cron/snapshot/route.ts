import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { refreshAllPrices } from "@/lib/services/price-service";
import { getAllExchangeRates } from "@/lib/services/exchange-rate-service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Refresh all prices first to ensure the snapshot is accurate
    console.log("Cron: Refreshing prices...");
    await refreshAllPrices();

    // 2. Pre-fetch shared data for all users (optimization)
    const [prices, allRatesMap, users] = await Promise.all([
      prisma.priceCache.findMany(),
      getAllExchangeRates(),
      prisma.user.findMany({
        include: { appSettings: true },
      }),
    ]);

    const priceMap = new Map<string, { price: number; currency: string }>(
      prices.map((p) => [p.symbol, { price: Number(p.price), currency: p.currency }])
    );

    // 3. Create snapshots for each user (in parallel)
    const snapshots = await Promise.all(
      users.map((user) => {
        const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
        console.log(`Cron: Creating snapshot for user ${user.id} (${baseCurrency})...`);
        return createSnapshot(user.id, baseCurrency, priceMap, allRatesMap);
      })
    );
    const results = snapshots.map((s) => s.id);

    return NextResponse.json({
      success: true,
      snapshotIds: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron snapshot failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
