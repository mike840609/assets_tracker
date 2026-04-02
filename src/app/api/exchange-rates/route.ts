import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rates = await prisma.exchangeRate.findMany();
  return NextResponse.json(rates);
}
