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

    // 2. Get all users and their settings
    const users = await prisma.user.findMany({
      include: { appSettings: true },
    });

    // 3. Create snapshots for each user
    const results = [];
    for (const user of users) {
      const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
      console.log(`Cron: Creating snapshot for user ${user.id} (${baseCurrency})...`);
      const snapshot = await createSnapshot(user.id, baseCurrency);
      results.push(snapshot.id);
    }

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
