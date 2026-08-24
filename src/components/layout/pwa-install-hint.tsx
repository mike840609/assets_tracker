"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { copyPageUrl, publishUntilRendered, shouldShowSafariPwaHint } from "@/lib/pwa-install-hint";
import { CLIENT_STORAGE_KEYS, readClientStorage, writeClientStorage } from "@/lib/client-storage";

const STORAGE_KEY = CLIENT_STORAGE_KEYS.pwaSafariHintShown;
const TOAST_ID = "pwa-safari-install-hint";
// Also the CSS hook for the full-height Copy link button in globals.css.
const TOAST_CLASS = "pwa-install-hint";
const COPY_SUCCESS_DURATION_MS = 2_000;

const COPY = {
  "en-US": {
    title: "Use astt like an app",
    description:
      "Open this site in Safari, then tap Share → Add to Home Screen for a more app-like experience.",
    copyLink: "Copy link",
    copied: "Copied",
  },
  "zh-TW": {
    title: "像 App 一樣使用 astt",
    description: "使用 Safari 開啟後，點選分享 → 加入主畫面，即可獲得更接近原生 App 的體驗。",
    copyLink: "複製連結",
    copied: "已複製",
  },
} as const;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function PwaInstallHint() {
  const locale = useLocale();

  useEffect(() => {
    const hasBeenShown = readClientStorage(window.localStorage, STORAGE_KEY, ["1"]) === "1";

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
    let copiedResetTimer: number | undefined;
    let dismissed = false;

    const clearCopiedResetTimer = () => {
      if (copiedResetTimer === undefined) return;
      window.clearTimeout(copiedResetTimer);
      copiedResetTimer = undefined;
    };

    const markShown = () => {
      writeClientStorage(window.localStorage, STORAGE_KEY, "1");
    };

    const showToast = (actionLabel: string) => {
      toast.info(copy.title, {
        id: TOAST_ID,
        description: copy.description,
        duration: Number.POSITIVE_INFINITY,
        closeButton: true,
        className: TOAST_CLASS,
        style: { paddingTop: 8, paddingBottom: 8 },
        onDismiss: () => {
          dismissed = true;
          clearCopiedResetTimer();
          // Dismissing counts as shown, even if it beat the render check.
          markShown();
        },
        action: {
          label: actionLabel,
          onClick: (event) => {
            event.preventDefault();

            void (async () => {
              const copied = await copyPageUrl(
                navigator.clipboard?.writeText?.bind(navigator.clipboard),
                window.location.href,
              );

              if (!copied || dismissed) return;

              showToast(copy.copied);
              clearCopiedResetTimer();
              copiedResetTimer = window.setTimeout(() => {
                if (!dismissed) showToast(copy.copyLink);
                copiedResetTimer = undefined;
              }, COPY_SUCCESS_DURATION_MS);
            })();
          },
        },
      });
    };

    publishUntilRendered({
      publish: () => showToast(copy.copyLink),
      hasRendered: () => document.querySelector(`[data-sonner-toast].${TOAST_CLASS}`) !== null,
      onRendered: markShown,
      isCancelled: () => dismissed,
    });

    return () => {
      dismissed = true;
      clearCopiedResetTimer();
    };
  }, [locale]);

  return null;
}
