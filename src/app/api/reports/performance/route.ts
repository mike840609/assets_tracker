import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNormalizedHistory } from "@/lib/services/history-service";
import { computePerformancePeriods } from "@/lib/performance-utils";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "monthly") as
    | "monthly"
    | "yearly";
  const currency = searchParams.get("currency") ?? "USD";

  const snapshots = await getNormalizedHistory(session.user.id, currency);
  const data = computePerformancePeriods(snapshots, period);

  return NextResponse.json(data);
}
