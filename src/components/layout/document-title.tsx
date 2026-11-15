import { getTranslations } from "next-intl/server";

type NavKey =
  | "dashboard"
  | "accounts"
  | "goals"
  | "stocks"
  | "analysis"
  | "history"
  | "projections"
  | "calendar"
  | "settings"
  | "changelog";

/**
 * Per-page localized <title>. Rendered as React 19 document metadata inside the
 * page's dynamic subtree instead of generateMetadata(): request-bound locale
 * reads in generateMetadata can break PPR resume under Cache Components (see
 * src/app/landing/page.tsx). (main)/layout.tsx clears the root title so this is
 * the only <title> on authenticated pages.
 */
export async function DocumentTitle({ navKey, title }: { navKey?: NavKey; title?: string }) {
  const t = navKey ? await getTranslations("nav") : null;
  const label = title ?? (t && navKey ? t(navKey) : null);
  return <title>{label ? `${label} · astt` : "astt"}</title>;
}
