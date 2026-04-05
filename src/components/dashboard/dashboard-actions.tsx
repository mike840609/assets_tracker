"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Camera, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";

interface DashboardActionsProps {
  baseCurrency: string;
  lastPriceUpdate?: string | null;
  lastSnapshotDate?: string | null;
}

export function DashboardActions({
  baseCurrency,
  lastPriceUpdate,
  lastSnapshotDate,
}: DashboardActionsProps) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      const data = await res.json();
      await fetch("/api/exchange-rates/refresh", { method: "POST" });
      toast.success(t("refreshSuccess", { count: data.updated }));
      router.refresh();
    } catch {
      toast.error(t("refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  const priceAge = lastPriceUpdate
    ? formatDistanceToNow(new Date(lastPriceUpdate), { addSuffix: true, locale: dateLocale })
    : null;

  const snapshotAge = lastSnapshotDate
    ? formatDistanceToNow(new Date(lastSnapshotDate), { addSuffix: true, locale: dateLocale })
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
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? t("refreshing") : t("refreshPrices")}
        </Button>
      </div>
    </div>
  );
}
