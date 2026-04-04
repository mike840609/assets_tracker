import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { refreshAllPrices } from "@/lib/services/price-service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Refresh all prices first to ensure the snapshot is accurate
    console.log("Cron: Refreshing prices...");
    await refreshAllPrices();

    // 2. Get the current base currency from settings
    const settings = await prisma.setting.findFirst();
    const baseCurrency = settings?.baseCurrency ?? "USD";

    // 3. Create the snapshot
    console.log(`Cron: Creating snapshot for ${baseCurrency}...`);
    const snapshot = await createSnapshot(baseCurrency);

    return NextResponse.json({
      success: true,
      snapshotId: snapshot.id,
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
