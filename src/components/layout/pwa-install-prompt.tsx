"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { publishUntilRendered } from "@/lib/pwa-install-hint";
import { isStandalonePwa, shouldOfferPwaInstall } from "@/lib/pwa-install-status";

const STORAGE_KEY = "assets-tracker:pwa-install-prompt-dismissed";
const TOAST_ID = "pwa-install-prompt";
// DOM hook so publishUntilRendered can confirm the toast really mounted.
const TOAST_CLASS = "pwa-install-prompt";

const COPY = {
  "en-US": {
    title: "Install astt",
    description: "Add it to your home screen for a faster, app-like experience.",
    action: "Install",
  },
  "zh-TW": {
    title: "安裝 astt",
    description: "加入主畫面，享受更快速、更接近原生 App 的使用體驗。",
    action: "安裝",
  },
} as const;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

function readDismissedFlag(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismissedFlag(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Install onboarding is optional; storage failures must not affect rendering.
  }
}

function getStandaloneStatus(): boolean {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;

  try {
    return isStandalonePwa({
      displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
      navigatorStandalone: navigatorWithStandalone.standalone === true,
    });
  } catch {
    return navigatorWithStandalone.standalone === true;
  }
}

export function PwaInstallPrompt() {
  const locale = useLocale();
  const offeredRef = useRef(false);

  useEffect(() => {
    const copy = locale === "zh-TW" ? COPY["zh-TW"] : COPY["en-US"];
    let settled = false;

    const handleBeforeInstallPrompt = (rawEvent: Event) => {
      const event = rawEvent as BeforeInstallPromptEvent;
      event.preventDefault();

      if (
        offeredRef.current ||
        !shouldOfferPwaInstall({
          userAgent: navigator.userAgent,
          isStandalone: getStandaloneStatus(),
          wasDismissed: readDismissedFlag(),
          hasInstallPrompt: true,
        })
      ) {
        return;
      }

      offeredRef.current = true;
      let installPromptStarted = false;

      const markSuggestionDismissed = () => {
        if (installPromptStarted) return;
        settled = true;
        persistDismissedFlag();
      };

      const showToast = () => {
        toast.info(copy.title, {
          id: TOAST_ID,
          className: TOAST_CLASS,
          description: copy.description,
          duration: 10_000,
          action: {
            label: copy.action,
            onClick: () => {
              installPromptStarted = true;
              settled = true;
              void (async () => {
                try {
                  await event.prompt();
                  const choice = await event.userChoice;
                  if (choice.outcome === "dismissed") persistDismissedFlag();
                } catch {
                  // Browsers can invalidate a deferred prompt; leave the app unaffected.
                } finally {
                  toast.dismiss(TOAST_ID);
                }
              })();
            },
          },
          onDismiss: markSuggestionDismissed,
          onAutoClose: markSuggestionDismissed,
        });
      };

      // The <Toaster> is a dynamic() import that can subscribe after
      // beforeinstallprompt fires, and Sonner never replays a dropped toast.
      publishUntilRendered({
        publish: showToast,
        hasRendered: () => document.querySelector(`[data-sonner-toast].${TOAST_CLASS}`) !== null,
        onRendered: () => {},
        isCancelled: () => settled,
      });
    };

    const handleAppInstalled = () => {
      settled = true;
      toast.dismiss(TOAST_ID);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      settled = true;
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [locale]);

  return null;
}
