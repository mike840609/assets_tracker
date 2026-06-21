"use client";

import { ChevronLeft, Eye, EyeOff, Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { useLargeTitle } from "./large-title-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hapticTick } from "@/lib/haptics";
import { AppIcon } from "./app-icon";

function getPageTitle(pathname: string, nav: (k: string) => string): string {
  if (pathname === "/") return nav("dashboard");
  if (pathname.startsWith("/accounts")) return nav("accounts");
  if (pathname.startsWith("/goals")) return nav("goals");
  if (pathname.startsWith("/stocks")) return nav("stocks");
  if (pathname.startsWith("/analysis")) return nav("analysis");
  if (pathname.startsWith("/history")) return nav("history");
  if (pathname.startsWith("/settings")) return nav("settings");
  if (pathname.startsWith("/changelog")) return nav("changelog");
  return "";
}

export function MobileHeader() {
  const t = useTranslations();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const hidden = useHideOnScroll();
  const { isVisible } = useLargeTitle();
  const pathname = usePathname();
  const router = useRouter();

  const pageTitle = getPageTitle(pathname, (k) => t(`nav.${k}`));
  const isNestedRoute = pathname !== "/" && /^\/[^/]+\/.+/.test(pathname);
  const showBackButton = isNestedRoute && !isVisible;

  const handleBack = () => {
    hapticTick();
    router.back();
  };

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 left-0 right-0 z-50 backdrop-blur-md",
        "bg-background/80 dark:bg-card/80",
        "shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]",
        "px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]",
        "flex items-center justify-between",
        "border-b transition-[border-color,transform] motion-normal",
        hidden ? "-translate-y-full" : "translate-y-0",
        // Separator only appears once the large title is behind the bar (iOS behaviour)
        isVisible ? "border-transparent" : "border-border/50",
      )}
    >
      {/* Back button — appears on nested routes once the large title scrolls off */}
      {showBackButton && (
        <button
          type="button"
          onClick={handleBack}
          aria-label={t("common.back")}
          className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full h-11 w-11 text-foreground hover:bg-muted/60 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-normal"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Left: logo + app name — fades away when the large title scrolls out */}
      <div
        className={cn(
          "flex items-center gap-2 min-w-0 transition-all motion-normal",
          !isVisible && "opacity-0 pointer-events-none -translate-y-1 scale-95",
        )}
      >
        <AppIcon
          gradientId="mobile-icon-g"
          className="h-6 w-6 shrink-0 drop-shadow-lg dark:drop-shadow-[0_3px_10px_rgba(52,211,153,0.25)]"
        />
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground truncate">
            {t("app.name")}
          </h1>
          <p className="text-[11px] text-muted-foreground font-medium -mt-1 uppercase tracking-wider truncate">
            {t("app.subtitleMobile")}
          </p>
        </div>
      </div>

      {/* Centre: small page title — slides in when the large title collapses */}
      <span
        aria-hidden={isVisible}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold text-foreground",
          "transition-all motion-normal pointer-events-none select-none",
          isVisible ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        )}
      >
        {pageTitle}
      </span>

      {/* Right: controls — always visible */}
      <div className="flex items-center gap-1">
        <button
          onClick={togglePrivacyMode}
          title={privacyMode ? "Show values" : "Hide values"}
          aria-label={privacyMode ? "Show values" : "Hide values"}
          className="inline-flex items-center justify-center rounded-md h-11 w-11 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <ThemeToggle variant="popover" />
        <Link
          href="/settings"
          aria-label={t("nav.settings")}
          className={cn(
            "inline-flex items-center justify-center rounded-md h-11 w-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            pathname.startsWith("/settings")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
