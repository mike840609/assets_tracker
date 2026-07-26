import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_VERSION, CHANGELOG, resolveChangeText } from "@/lib/changelog";
import { LICENSE_URL, REPO_URL } from "@/lib/repo";
import type { Locale } from "@/i18n/config";

/** GitHub mark — lucide dropped brand icons, so it ships inline. */
function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export async function VersionCard() {
  const [t, locale] = await Promise.all([getTranslations("settings"), getLocale()]);
  const latest = CHANGELOG[0];
  const releasedOn = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${latest.date}T00:00:00`));
  const highlights = latest.changes.slice(0, 3);

  return (
    <section className="space-y-3 w-full">
      <h3 className="text-lg font-semibold text-foreground">{t("versionTitle")}</h3>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{t("versionCurrent")}</p>
              <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                v{APP_VERSION}
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("versionReleased", { date: releasedOn })}
            </span>
          </div>

          <div className="space-y-2 rounded-md bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {t("versionWhatsNew", { version: `v${APP_VERSION}` })}
            </p>
            <ul className="space-y-1.5">
              {highlights.map((change, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground/90">
                  <span
                    aria-hidden
                    className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                  <span className="text-pretty">
                    {resolveChangeText(change.text, locale as Locale)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The license claim is the point of this block, so it reads as a
              sentence rather than a bare link, and "MIT License" resolves to the
              license text itself so the claim is verifiable. */}
          <div className="flex gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
            <GitHubIcon className="mt-0.5 h-4 w-4 text-foreground/70" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t("versionOpenSourceTitle")}</p>
              <p className="text-sm text-muted-foreground text-pretty">
                {t.rich("versionOpenSource", {
                  license: (chunks) => (
                    <a
                      href={LICENSE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/changelog"
              prefetch={false}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              {t("versionViewChangelog")}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              {t("versionSourceCode")}
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
