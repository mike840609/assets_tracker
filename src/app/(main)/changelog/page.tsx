import { DocumentTitle } from "@/components/layout/document-title";
import { getLocale, getTranslations } from "next-intl/server";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { ChangelogTimeline } from "@/components/changelog/changelog-timeline";
import { CHANGELOG, APP_VERSION } from "@/lib/changelog";
import { REPO_URL } from "@/lib/repo";
import { ArrowUpRightIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";

export default async function ChangelogPage() {
  const [t, locale] = await Promise.all([getTranslations("changelog"), getLocale()]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-16 animate-in fade-in duration-200">
      <DocumentTitle title={t("title")} />
      <header className="space-y-3">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>
        <p className="max-w-prose text-base text-muted-foreground text-pretty">{t("subtitle")}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-foreground/80">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("currentVersion", { version: `v${APP_VERSION}` })}
        </span>
        <a
          href={`${REPO_URL}/releases`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("viewReleases")}
          <ArrowUpRightIcon className="h-3.5 w-3.5" />
        </a>
      </header>

      <ChangelogTimeline releases={CHANGELOG} locale={locale as Locale} />
    </div>
  );
}
