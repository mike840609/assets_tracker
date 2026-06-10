"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { hapticTick } from "@/lib/haptics";
import { FreshnessBadge } from "@/components/ui/freshness-badge";

interface DashboardActionsProps {
  baseCurrency: string;
  lastPriceUpdate?: string | null;
  lastSnapshotDate?: string | null;
}

export function DashboardActions({ lastPriceUpdate, lastSnapshotDate }: DashboardActionsProps) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");
  const [refreshing, setRefreshing] = useState(false);
  const [clientRefreshAt, setClientRefreshAt] = useState<string | null>(null);

  const handleRefreshPrices = useCallback(async () => {
    hapticTick();
    setRefreshing(true);
    try {
      const [priceRes, ratesRes] = await Promise.all([
        fetch("/api/prices/refresh", { method: "POST" }),
        fetch("/api/exchange-rates/refresh", { method: "POST" }),
      ]);
      if (!priceRes.ok || !ratesRes.ok) throw new Error("Refresh failed");
      const { data: priceData } = await priceRes.json();
      if (priceData.updated > 0) {
        toast.success(t("refreshSuccess", { count: priceData.updated }));
      } else if (priceData.errors?.length) {
        // Fetch failed for every symbol — don't dress it up as a success
        toast.error(t("refreshFailed"));
      } else {
        // Everything was inside the refresh TTL — "0 updated" reads like a
        // failure, so say what actually happened
        toast.success(t("refreshUpToDate"));
      }
      setClientRefreshAt(new Date().toISOString());
      window.dispatchEvent(new CustomEvent("prices:refreshed"));
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

  // Pull-to-refresh runs its own fetch and dispatches "prices:refreshed" when done.
  // Stamp clientRefreshAt so the badge shows the user's action time even when the
  // server-side updatedAt didn't move (e.g. refreshAllPrices returned `updated: 0`).
  useEffect(() => {
    const handler = () => setClientRefreshAt(new Date().toISOString());
    window.addEventListener("prices:refreshed", handler);
    return () => window.removeEventListener("prices:refreshed", handler);
  }, []);

  const effectiveLastUpdate =
    clientRefreshAt && (!lastPriceUpdate || clientRefreshAt > lastPriceUpdate)
      ? clientRefreshAt
      : lastPriceUpdate;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
      <div
        className="flex flex-nowrap items-center gap-1.5 sm:gap-x-4 text-xs text-muted-foreground overflow-hidden min-w-0"
        aria-live="polite"
      >
        {effectiveLastUpdate && (
          <FreshnessBadge kind="price" timestamp={effectiveLastUpdate} mobileShort />
        )}
        {lastSnapshotDate && (
          <FreshnessBadge kind="snapshot" timestamp={lastSnapshotDate} mobileShort />
        )}
        {!effectiveLastUpdate && !lastSnapshotDate && (
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
