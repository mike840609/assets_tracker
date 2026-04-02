import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/validators";

export async function GET() {
  const settings = await prisma.setting.upsert({
    where: { id: "app_settings" },
    update: {},
    create: { id: "app_settings", baseCurrency: "USD" },
  });
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.setting.upsert({
    where: { id: "app_settings" },
    update: { baseCurrency: parsed.data.baseCurrency },
    create: { id: "app_settings", baseCurrency: parsed.data.baseCurrency },
  });
  return NextResponse.json(settings);
}
