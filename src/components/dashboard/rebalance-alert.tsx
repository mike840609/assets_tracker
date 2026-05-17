"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AllocationDriftItem } from "@/lib/types";

interface Props {
  alerts: AllocationDriftItem[];
}

/**
 * Fires a Sonner toast for each over-threshold drift item.
 * Uses sessionStorage to show at most once per browser session.
 */
export function RebalanceAlert({ alerts }: Props) {
  const t = useTranslations("allocation");
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || alerts.length === 0) return;
    const key = "rebalance-alert-shown";
    if (sessionStorage.getItem(key)) return;

    fired.current = true;
    sessionStorage.setItem(key, "1");

    for (const alert of alerts.slice(0, 3)) {
      const sign = alert.drift >= 0 ? "+" : "";
      toast.warning(
        t("alertToast", {
          label: alert.label,
          drift: `${sign}${alert.drift.toFixed(1)}`,
          threshold: alert.driftThreshold.toFixed(1),
        }),
        { duration: 8000 },
      );
    }

    if (alerts.length > 3) {
      toast.warning(t("alertToastMore", { count: alerts.length - 3 }), { duration: 8000 });
    }
  }, [alerts, t]);

  return null;
}
