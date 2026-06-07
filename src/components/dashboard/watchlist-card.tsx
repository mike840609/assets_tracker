"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChartCandlestick, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { cn } from "@/lib/utils";
import type { SerializedTrackedStock } from "@/lib/services/stock-watch-service";

const HIDDEN = "***";
const PREVIEW_LIMIT = 3;

function HeaderLink({
  href,
  children,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

function useMarketFormatters() {
  const locale = useLocale();
  const { privacyMode } = usePrivacyMode();

  return {
    money(value: number | null, currency: string) {
      if (privacyMode) return HIDDEN;
      if (value === null) return null;
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 4,
      }).format(value);
    },
    percent(value: number | null) {
      if (privacyMode) return HIDDEN;
      if (value === null) return null;
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value / 100);
    },
  };
}

function WatchlistRow({ stock }: { stock: SerializedTrackedStock }) {
  const t = useTranslations("stocks");
  const format = useMarketFormatters();
  const currency = stock.latestPriceCurrency ?? stock.currency;
  const latestPrice = format.money(stock.latestPrice, currency);
  const changePercent = format.percent(stock.changePercent);
  const hasDirection = stock.change !== null || stock.changePercent !== null;
  const isGain = (stock.change ?? stock.changePercent ?? 0) >= 0;
  const DirectionIcon = isGain ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border/50 py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm font-semibold tracking-normal">
            {stock.symbol}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {stock.currency}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">{stock.name}</p>
      </div>

      <div className="min-w-0 text-right">
        <p className="truncate font-mono text-sm font-semibold tabular-nums">
          {latestPrice ?? t("unavailable")}
        </p>
        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 font-mono text-xs font-semibold tabular-nums text-muted-foreground",
            hasDirection && (isGain ? "text-gain" : "text-loss"),
          )}
        >
          {hasDirection && <DirectionIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
          {changePercent ?? t("noLatestPrice")}
        </p>
      </div>
    </div>
  );
}

export function WatchlistCard({ stocks }: { stocks: SerializedTrackedStock[] }) {
  const t = useTranslations("stocks");
  const previewStocks = stocks.slice(0, PREVIEW_LIMIT);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ChartCandlestick className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <CardTitle asChild>
              <h2 className="truncate">{t("title")}</h2>
            </CardTitle>
          </div>
          <HeaderLink href="/stocks" ariaLabel={t("viewAllAria")}>
            {t("viewAll")}
          </HeaderLink>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {previewStocks.length > 0 ? (
          <div>
            {previewStocks.map((stock) => (
              <WatchlistRow key={stock.id} stock={stock} />
            ))}
            {stocks.length > PREVIEW_LIMIT && (
              <p className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                {t("dashboardPreviewCount", {
                  shown: PREVIEW_LIMIT,
                  count: stocks.length,
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("dashboardEmptyTitle")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("dashboardEmptyBody")}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
