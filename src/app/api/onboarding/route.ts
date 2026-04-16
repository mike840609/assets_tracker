import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

/**
 * DELETE /api/onboarding
 * Marks onboarding as completed for the authenticated user.
 * Called when the user finishes or skips the tutorial dialog.
 */
export const DELETE = withAuth(async (_req, _ctx, userId) => {
  await prisma.setting.upsert({
    where: { userId },
    update: { onboardingCompleted: true },
    create: {
      userId,
      onboardingCompleted: true,
      baseCurrency: "USD",
      locale: "en-US",
    },
  });

  // Bust the unstable_cache wrapping getOrCreateSettings so the layout
  // re-renders with onboardingCompleted: true on the next router.refresh().
  revalidateTag("settings");

  return ok({ ok: true });
});
