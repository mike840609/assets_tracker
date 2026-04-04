import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/validators";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let settings = await prisma.setting.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.setting.create({ data: { userId, baseCurrency: "USD" } });
  }
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.setting.upsert({
    where: { userId },
    update: { baseCurrency: parsed.data.baseCurrency },
    create: { userId, baseCurrency: parsed.data.baseCurrency },
  });
  return NextResponse.json(settings);
}
