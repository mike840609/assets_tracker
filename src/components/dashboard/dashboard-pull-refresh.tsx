"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";

export function DashboardPullRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");

  const onRefresh = useCallback(async () => {
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
      window.dispatchEvent(new CustomEvent("prices:refreshed"));
      router.refresh();
    } catch {
      toast.error(t("refreshFailed"));
    }
  }, [router, t]);

  return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>;
}
