import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { getNormalizedHistory } from "@/lib/services/history-service";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const baseCurrency = searchParams.get("currency") ?? "USD";

  const options: { from?: Date; to?: Date } = {};
  if (from) options.from = new Date(from);
  if (to) options.to = new Date(to);

  const snapshots = await getNormalizedHistory(session.user.id, baseCurrency, options);
  return NextResponse.json(snapshots);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const baseCurrency = body.baseCurrency ?? "USD";
  const snapshot = await createSnapshot(session.user.id, baseCurrency);
  return NextResponse.json(snapshot, { status: 201 });
}
