import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { refreshAllPrices } from "@/lib/services/price-service";
import { ok, failure } from "@/lib/api-responses";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Refresh all prices first to ensure the snapshot is accurate
    console.log("Cron: Refreshing prices...");
    await refreshAllPrices();
    // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
    revalidateTag("net-worth", "max");

    // 2. Get all users and their settings
    const users = await prisma.user.findMany({
      include: { appSettings: true },
    });

    // 3. Create snapshots for each user (in parallel)
    const snapshots = await Promise.all(
      users.map((user) => {
        const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
        console.log(`Cron: Creating snapshot for user ${user.id} (${baseCurrency})...`);
        return createSnapshot(user.id, baseCurrency);
      })
    );

    // 4. Invalidate snapshot/history caches now that new rows exist
    revalidateTag("snapshots", "max");
    for (const user of users) {
      revalidateTag(`history:${user.id}`, "max");
    }

    return ok({
      success: true,
      snapshotIds: snapshots.map((s) => s.id),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron snapshot failed:", error);
    return failure("Internal Server Error", 500);
  }
}
