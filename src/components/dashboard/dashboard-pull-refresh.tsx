"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { refreshMarketData } from "@/lib/refresh-client";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";

export function DashboardPullRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("dashboardActions");

  const onRefresh = useCallback(async () => {
    const outcome = await refreshMarketData();
    switch (outcome.status) {
      case "updated":
        toast.success(t("refreshSuccess", { count: outcome.prices }));
        if (outcome.ratesFetchFailed) toast.warning(t("ratesRefreshFailed"));
        router.refresh();
        break;
      case "fresh":
        if (outcome.ratesFetchFailed) {
          toast.warning(t("ratesRefreshFailed"));
        } else {
          toast.info(t("alreadyFresh", { seconds: outcome.retryAfterSeconds }));
        }
        break;
      case "cooldown":
        toast.info(t("cooldownWait", { seconds: outcome.retryAfterSeconds }));
        break;
      case "error":
        toast.error(t("refreshFailed"));
        break;
    }
  }, [router, t]);

  return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>;
}
