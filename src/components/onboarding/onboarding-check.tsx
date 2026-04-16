import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { prisma } from "@/lib/prisma";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { OnboardingAutoOpen } from "./onboarding-auto-open";

/**
 * Async RSC that gates the onboarding tutorial.
 * Renders OnboardingAutoOpen only when:
 *   1. User is authenticated
 *   2. onboardingCompleted is false
 *   3. User has no accounts yet (existing users with data are never shown the tutorial)
 *
 * All onboarding logic lives here — the layout stays dumb and non-async.
 */
export async function OnboardingCheck() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const settings = await getOrCreateSettings(session.user.id);
  if (settings.onboardingCompleted) return null;

  // Protect existing users who had accounts before this feature was added.
  // If they already have accounts, skip the tutorial without writing to the DB —
  // the accountCount > 0 guard is sufficient; onboardingCompleted staying false
  // in the DB is harmless because this check always short-circuits first.
  const accountCount = await prisma.account.count({
    where: { userId: session.user.id },
  });
  if (accountCount > 0) return null;

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={pickMessages(messages, ["onboarding"])}>
      <OnboardingAutoOpen />
    </NextIntlClientProvider>
  );
}
