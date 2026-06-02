"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
          <ChartEmptyState message={t("topMoversNoData")} hint={t("emptyHint")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-muted-foreground text-xs hover:bg-transparent">
                <TableHead className="h-auto px-0 pb-2 font-medium">
                  {t("topMoversAccount")}
                </TableHead>
                <TableHead className="hidden sm:table-cell h-auto px-0 pb-2 text-right font-medium tabular-nums">
                  {t("tooltipStart")}
                </TableHead>
                <TableHead className="hidden sm:table-cell h-auto px-0 pb-2 text-right font-medium tabular-nums">
                  {t("tooltipEnd")}
                </TableHead>
                <TableHead className="h-auto px-0 pb-2 text-right font-medium tabular-nums">
                  {t("topMoversChange")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movers.map((m) => {
                const isPositive = m.absoluteChange >= 0;
                const sign = isPositive ? "+" : "";
                const pct =
                  m.percentChange === null
                    ? "—"
                    : `${isPositive ? "+" : ""}${m.percentChange.toFixed(1)}%`;

                return (
                  <TableRow key={m.accountId}>
                    <TableCell
                      className={`${isCompact ? "py-1.5" : "py-2.5"} px-0 pr-3 whitespace-normal align-top`}
                    >
                      <div className="font-medium leading-tight truncate">{m.accountName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {tCat(m.category as Parameters<typeof tCat>[0], {
                          defaultValue: m.category,
                        })}
                      </div>
                      {/* Mobile-only: collapsed start→end summary, hidden once columns appear */}
                      <div className="sm:hidden text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">
                        {privacyMode
                          ? "***"
                          : `${formatCurrency(m.startValue, baseCurrency)} → ${formatCurrency(m.endValue, baseCurrency)}`}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`hidden sm:table-cell ${isCompact ? "py-1.5" : "py-2.5"} px-0 text-right tabular-nums text-muted-foreground`}
                    >
                      {privacyMode ? "***" : formatCurrency(m.startValue, baseCurrency)}
                    </TableCell>
                    <TableCell
                      className={`hidden sm:table-cell ${isCompact ? "py-1.5" : "py-2.5"} px-0 text-right tabular-nums`}
                    >
                      {privacyMode ? "***" : formatCurrency(m.endValue, baseCurrency)}
                    </TableCell>
                    <TableCell
                      className={`${isCompact ? "py-1.5" : "py-2.5"} px-0 text-right align-top`}
                    >
                      <div className="flex justify-end">
                        <Badge
                          variant={isPositive ? "gain" : "loss"}
                          className="h-auto py-0.5 text-sm font-semibold tabular-nums"
                        >
                          {privacyMode
                            ? "***"
                            : `${sign}${formatCurrency(m.absoluteChange, baseCurrency)}`}
                        </Badge>
                      </div>
                      <div
                        className={`text-xs tabular-nums mt-0.5 ${isPositive ? "text-[var(--gain)]/80" : "text-[var(--loss)]/80"}`}
                      >
                        {privacyMode ? "***" : pct}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
