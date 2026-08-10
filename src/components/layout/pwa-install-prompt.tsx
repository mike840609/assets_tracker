"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { isStandalonePwa, shouldOfferPwaInstall } from "@/lib/pwa-install-status";

const STORAGE_KEY = "assets-tracker:pwa-install-prompt-dismissed";

const COPY = {
  "en-US": {
    title: "Install Assets Tracker",
    description: "Add it to your home screen for a faster, app-like experience.",
    action: "Install",
  },
  "zh-TW": {
    title: "安裝 Assets Tracker",
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
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    const copy = locale === "zh-TW" ? COPY["zh-TW"] : COPY["en-US"];

    const dismissSuggestion = () => {
      persistDismissedFlag();
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };

    const handleBeforeInstallPrompt = (rawEvent: Event) => {
      const event = rawEvent as BeforeInstallPromptEvent;
      event.preventDefault();

      if (
        !shouldOfferPwaInstall({
          userAgent: navigator.userAgent,
          isStandalone: getStandaloneStatus(),
          wasDismissed: readDismissedFlag(),
          hasInstallPrompt: true,
        }) ||
        toastIdRef.current !== null
      ) {
        return;
      }

      let installPromptStarted = false;

      toastIdRef.current = toast.info(copy.title, {
        description: copy.description,
        duration: 10_000,
        action: {
          label: copy.action,
          onClick: () => {
            installPromptStarted = true;
            void (async () => {
              try {
                await event.prompt();
                const choice = await event.userChoice;
                if (choice.outcome === "dismissed") persistDismissedFlag();
              } catch {
                // Browsers can invalidate a deferred prompt; leave the app unaffected.
              } finally {
                toastIdRef.current = null;
              }
            })();
          },
        },
        onDismiss: () => {
          if (!installPromptStarted) dismissSuggestion();
        },
        onAutoClose: () => {
          if (!installPromptStarted) dismissSuggestion();
        },
      });
    };

    const handleAppInstalled = () => {
      if (toastIdRef.current !== null) toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [locale]);

  return null;
}
