"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { TopMover } from "@/lib/services/analysis-service";

interface Props {
  movers: TopMover[];
  baseCurrency: string;
}

export function TopMoversList({ movers, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("topMovers")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("topMoversSubtitle")}</p>
      </CardHeader>
      <CardContent>
        {movers.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("topMoversNoData")}
          </div>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {movers.map((m) => {
                const isPositive = m.absoluteChange >= 0;
                const sign = isPositive ? "+" : "";
                const pct =
                  m.percentChange === null
                    ? "—"
                    : `${isPositive ? "+" : ""}${m.percentChange.toFixed(1)}%`;
                const pillClass = isPositive
                  ? "bg-[color-mix(in_oklch,var(--chart-1)_18%,transparent)] text-[var(--chart-1)]"
                  : "bg-destructive/15 text-destructive";

                return (
                  <article
                    key={m.accountId}
                    className="rounded-xl border border-border/60 bg-muted/20 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium leading-tight">
                          {m.accountName}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tCat(m.category as Parameters<typeof tCat>[0], {
                            defaultValue: m.category,
                          })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${pillClass}`}
                        >
                          {privacyMode ? (
                            "***"
                          ) : (
                            <>
                              {sign}
                              {formatCurrency(m.absoluteChange, baseCurrency)}
                            </>
                          )}
                        </span>
                        <div
                          className={`mt-1 text-xs tabular-nums ${isPositive ? "text-[var(--chart-1)]/80" : "text-destructive/80"}`}
                        >
                          {privacyMode ? "***" : pct}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-background/60 p-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">{t("tooltipStart")}</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {privacyMode ? "***" : formatCurrency(m.startValue, baseCurrency)}
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-muted-foreground">{t("tooltipEnd")}</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {privacyMode ? "***" : formatCurrency(m.endValue, baseCurrency)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-xs">
                    <th className="pb-2 text-left font-medium">{t("topMoversAccount")}</th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      {t("tooltipStart")}
                    </th>
                    <th className="pb-2 text-right font-medium tabular-nums">{t("tooltipEnd")}</th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      {t("topMoversChange")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movers.map((m) => {
                    const isPositive = m.absoluteChange >= 0;
                    const sign = isPositive ? "+" : "";
                    const pct =
                      m.percentChange === null
                        ? "—"
                        : `${isPositive ? "+" : ""}${m.percentChange.toFixed(1)}%`;
                    const pillClass = isPositive
                      ? "bg-[color-mix(in_oklch,var(--chart-1)_18%,transparent)] text-[var(--chart-1)]"
                      : "bg-destructive/15 text-destructive";

                    return (
                      <tr
                        key={m.accountId}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className={`${isCompact ? "py-1.5" : "py-2.5"} pr-4`}>
                          <div className="font-medium leading-tight">{m.accountName}</div>
                          <div className="text-xs text-muted-foreground">
                            {tCat(m.category as Parameters<typeof tCat>[0], {
                              defaultValue: m.category,
                            })}
                          </div>
                        </td>
                        <td
                          className={`${isCompact ? "py-1.5" : "py-2.5"} text-right tabular-nums text-muted-foreground`}
                        >
                          {privacyMode ? "***" : formatCurrency(m.startValue, baseCurrency)}
                        </td>
                        <td
                          className={`${isCompact ? "py-1.5" : "py-2.5"} text-right tabular-nums`}
                        >
                          {privacyMode ? "***" : formatCurrency(m.endValue, baseCurrency)}
                        </td>
                        <td className={`${isCompact ? "py-1.5" : "py-2.5"} text-right`}>
                          <div className="flex justify-end">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${pillClass}`}
                            >
                              {privacyMode ? (
                                "***"
                              ) : (
                                <>
                                  {sign}
                                  {formatCurrency(m.absoluteChange, baseCurrency)}
                                </>
                              )}
                            </span>
                          </div>
                          <div
                            className={`text-xs tabular-nums mt-0.5 ${isPositive ? "text-[var(--chart-1)]/80" : "text-destructive/80"}`}
                          >
                            {privacyMode ? "***" : pct}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
