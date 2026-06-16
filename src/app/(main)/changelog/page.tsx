import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { ChangelogTimeline } from "@/components/changelog/changelog-timeline";
import { CHANGELOG, APP_VERSION } from "@/lib/changelog";
import type { Locale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("changelog");
  return { title: t("title") };
}

export default async function ChangelogPage() {
  const [t, locale] = await Promise.all([getTranslations("changelog"), getLocale()]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-16 animate-in fade-in duration-200">
      <header className="space-y-3">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>
        <p className="max-w-prose text-base text-muted-foreground text-pretty">{t("subtitle")}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-foreground/80">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("currentVersion", { version: `v${APP_VERSION}` })}
        </span>
      </header>

      <ChangelogTimeline releases={CHANGELOG} locale={locale as Locale} />
    </div>
  );
}
