"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { shouldShowSafariPwaHint } from "@/lib/pwa-install-hint";

const STORAGE_KEY = "assets-tracker:pwa-safari-hint-shown";

const COPY = {
  "en-US": {
    title: "Use Assets Tracker like an app",
    description:
      "Open this site in Safari, then tap Share → Add to Home Screen for a more app-like experience.",
  },
  "zh-TW": {
    title: "像 App 一樣使用 Assets Tracker",
    description: "使用 Safari 開啟後，點選分享 → 加入主畫面，即可獲得更接近原生 App 的體驗。",
  },
} as const;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function PwaInstallHint() {
  const locale = useLocale();

  useEffect(() => {
    let hasBeenShown: boolean;

    try {
      hasBeenShown = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return;
    }

    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    const shouldShow = shouldShowSafariPwaHint({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      isStandalone,
      hasBeenShown,
    });

    if (!shouldShow) return;

    const copy = locale === "zh-TW" ? COPY["zh-TW"] : COPY["en-US"];
    toast.info(copy.title, {
      description: copy.description,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
    });

    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // The hint is optional; storage failures must not affect app rendering.
    }
  }, [locale]);

  return null;
}
