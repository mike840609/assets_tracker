"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Camera, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { hapticTick } from "@/lib/haptics";

function getRelativeTime(dateString: string, locale: string, now: number) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  // Parse as local noon to avoid UTC-midnight causing off-by-one-day in non-UTC timezones
  const localDate = dateString.includes("T")
    ? new Date(dateString)
    : new Date(`${dateString}T12:00:00`);
  const diffInSeconds = Math.round((localDate.getTime() - now) / 1000);
  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) return rtf.format(Math.sign(diffInSeconds) * absDiff, "second");
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), "minute");
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), "hour");
  if (absDiff < 2592000) return rtf.format(Math.round(diffInSeconds / 86400), "day");
  if (absDiff < 31536000) return rtf.format(Math.round(diffInSeconds / 2592000), "month");
  return rtf.format(Math.round(diffInSeconds / 31536000), "year");
}

interface DashboardActionsProps {
  baseCurrency: string;
  lastPriceUpdate?: string | null;
  lastSnapshotDate?: string | null;
}

export function DashboardActions({ lastPriceUpdate, lastSnapshotDate }: DashboardActionsProps) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");
  const locale = useLocale();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const handleRefreshPrices = useCallback(async () => {
    hapticTick();
    setRefreshing(true);
    try {
      const [priceRes] = await Promise.all([
        fetch("/api/prices/refresh", { method: "POST" }),
        fetch("/api/exchange-rates/refresh", { method: "POST" }),
      ]);
      const { data: priceData } = await priceRes.json();
      toast.success(t("refreshSuccess", { count: priceData.updated }));
      router.refresh();
    } catch {
      toast.error(t("refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }, [router, t]);

  useEffect(() => {
    const handler = () => {
      void handleRefreshPrices();
    };
    window.addEventListener("prices:refresh", handler);
    return () => window.removeEventListener("prices:refresh", handler);
  }, [handleRefreshPrices]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const priceAge = lastPriceUpdate ? getRelativeTime(lastPriceUpdate, locale, now) : null;

  const snapshotAge = lastSnapshotDate ? getRelativeTime(lastSnapshotDate, locale, now) : null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
      <div
        className="flex flex-nowrap items-center gap-1.5 sm:gap-x-4 text-xs text-muted-foreground overflow-hidden min-w-0"
        aria-live="polite"
      >
        {priceAge && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-primary whitespace-nowrap">
            <Clock className="h-3 w-3 shrink-0" />
            {t("pricesUpdated", { age: priceAge })}
          </span>
        )}
        {snapshotAge && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-1.5 py-0.5 sm:px-2.5 sm:py-1 whitespace-nowrap">
            <Camera className="h-3 w-3 shrink-0" />
            {t("snapshot", { age: snapshotAge })}
          </span>
        )}
        {!priceAge && !snapshotAge && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t("noPriceData")}
          </span>
        )}
      </div>

      <div className="hidden md:flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="gap-2 rounded-full px-5 border-primary/20 bg-primary/5 hover:bg-primary/15 text-primary hover:text-primary transition-all shadow-sm hover:shadow"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? t("refreshing") : t("refreshPrices")}
        </Button>
      </div>
    </div>
  );
}
