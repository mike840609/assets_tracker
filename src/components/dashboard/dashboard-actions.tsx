"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Camera, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";

function getRelativeTime(dateString: string, locale: string) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffInSeconds = Math.round((new Date(dateString).getTime() - Date.now()) / 1000);
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

export function DashboardActions({
  lastPriceUpdate,
  lastSnapshotDate,
}: DashboardActionsProps) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");
  const locale = useLocale();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefreshPrices() {
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
  }

  const priceAge = lastPriceUpdate
    ? getRelativeTime(lastPriceUpdate, locale)
    : null;

  const snapshotAge = lastSnapshotDate
    ? getRelativeTime(lastSnapshotDate, locale)
    : null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {priceAge && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t("pricesUpdated", { age: priceAge })}
          </span>
        )}
        {snapshotAge && (
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3 w-3" />
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

      <div className="flex items-center gap-2">
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
