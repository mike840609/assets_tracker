"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";

export function PricesPullRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");

  const onRefresh = useCallback(async () => {
    try {
      const [priceRes, ratesRes] = await Promise.all([
        fetch("/api/prices/refresh", { method: "POST" }),
        fetch("/api/exchange-rates/refresh", { method: "POST" }),
      ]);

      if (!priceRes.ok || !ratesRes.ok) {
        throw new Error("One or more refresh requests failed");
      }

      const { data: priceData } = await priceRes.json();
      toast.success(t("refreshSuccess", { count: priceData.updated }));
      router.refresh();
    } catch {
      toast.error(t("refreshFailed"));
    }
  }, [router, t]);

  return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>;
}
