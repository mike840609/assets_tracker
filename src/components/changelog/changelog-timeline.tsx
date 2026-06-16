import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { type ChangeType, type Release, resolveChangeText } from "@/lib/changelog";

/**
 * Per-type chip color. `added` rides the schema's gain hue, `improved` borrows
 * the indigo chart token, `fixed` stays a calm neutral so bug-fix releases never
 * read as alarming. Colors are resolved from CSS tokens so they track the active
 * color schema and dark mode. The `fg` values are mixed toward the ink end to
 * clear 4.5:1 as 11px label text.
 */
const TYPE_STYLE: Record<ChangeType, { bg: string; fg: string }> = {
  added: {
    bg: "color-mix(in oklab, var(--gain) 14%, transparent)",
    fg: "var(--gain-ink)",
  },
  improved: {
    bg: "color-mix(in oklab, var(--chart-3) 14%, transparent)",
    fg: "color-mix(in oklab, var(--chart-3), var(--foreground) 28%)",
  },
  fixed: {
    bg: "var(--secondary)",
    fg: "var(--secondary-foreground)",
  },
};

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export async function ChangelogTimeline({
  releases,
  locale,
}: {
  releases: Release[];
  locale: Locale;
}) {
  const t = await getTranslations("changelog");

  if (releases.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <ol className="relative space-y-9">
      {/* Timeline rail — sits under the centers of the dots, trimmed to the
          first and last node so it never overshoots. */}
      <span
        aria-hidden
        className="absolute left-[5px] top-2.5 bottom-3 w-px bg-gradient-to-b from-border via-border to-transparent"
      />

      {releases.map((release, index) => {
        const isLatest = index === 0;
        return (
          <li
            key={release.version}
            style={{ animationDelay: `${Math.min(index, 8) * 55}ms`, animationFillMode: "both" }}
            className="relative pl-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
          >
            {/* Node */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-background",
                isLatest ? "bg-primary ring-2 ring-primary/25" : "bg-muted-foreground/40",
              )}
            />

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h3 className="font-mono text-base font-semibold tabular-nums tracking-tight text-foreground">
                v{release.version}
              </h3>
              {isLatest && (
                <span className="inline-flex h-5 items-center rounded-full bg-primary px-2 text-[11px] font-semibold tracking-wide text-primary-foreground">
                  {t("latest")}
                </span>
              )}
              <time dateTime={release.date} className="text-xs text-muted-foreground tabular-nums">
                {formatDate(release.date, locale)}
              </time>
            </div>

            {release.summary && (
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {resolveChangeText(release.summary, locale)}
              </p>
            )}

            <ul className="mt-3 space-y-2">
              {release.changes.map((change, changeIndex) => (
                <li key={changeIndex} className="grid grid-cols-[4.75rem_1fr] items-start gap-3">
                  <span
                    style={{
                      backgroundColor: TYPE_STYLE[change.type].bg,
                      color: TYPE_STYLE[change.type].fg,
                    }}
                    className="inline-flex h-5 w-full items-center justify-center rounded-full text-[11px] font-semibold tracking-tight"
                  >
                    {t(`types.${change.type}`)}
                  </span>
                  <span className="text-sm leading-relaxed text-foreground/90 text-pretty">
                    {resolveChangeText(change.text, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
