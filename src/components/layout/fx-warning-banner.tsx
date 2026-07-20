import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getUnresolvedRatePairs } from "@/lib/services/exchange-rate-service";

/**
 * App-wide banner shown while any exchange rate the user's data needs is
 * unavailable — those values render unconverted (1:1) everywhere, so the
 * warning belongs to the layout, not a single page.
 */
export async function FxWarningBanner() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const settings = await getOrCreateSettings(session.user.id);
  const pairs = await getUnresolvedRatePairs(session.user.id, settings.baseCurrency);
  if (pairs.length === 0) return null;
  const t = await getTranslations("fxWarning");
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{t("unresolvedRates", { pairs: pairs.join(", ") })}</span>
    </div>
  );
}
