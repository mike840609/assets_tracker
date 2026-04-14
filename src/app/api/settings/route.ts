import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/validators";
import { auth } from "@/auth";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { ok, failure, validationError } from "@/lib/api-responses";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return failure("Unauthorized", 401);

  const settings = await getOrCreateSettings(session.user.id);
  return ok(settings);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return failure("Unauthorized", 401);

  const userId = session.user.id;
  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const settings = await prisma.setting.upsert({
    where: { userId },
    update: {
      ...(parsed.data.baseCurrency !== undefined && { baseCurrency: parsed.data.baseCurrency }),
      ...(parsed.data.locale !== undefined && { locale: parsed.data.locale }),
    },
    create: {
      userId,
      baseCurrency: parsed.data.baseCurrency ?? "USD",
      locale: parsed.data.locale ?? "en-US",
    },
  });

  revalidateTag("settings", "max");

  const response = ok(settings);

  // Set locale cookie so next-intl picks it up on the next request
  if (parsed.data.locale) {
    response.cookies.set("NEXT_LOCALE", parsed.data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
