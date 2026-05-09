"use client";

import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { useLargeTitle } from "./large-title-context";
import { usePathname } from "next/navigation";

function getPageTitle(pathname: string, nav: (k: string) => string): string {
  if (pathname === "/") return nav("dashboard");
  if (pathname.startsWith("/accounts")) return nav("accounts");
  if (pathname.startsWith("/analysis")) return nav("analysis");
  if (pathname.startsWith("/history")) return nav("history");
  if (pathname.startsWith("/settings")) return nav("settings");
  return "";
}

export function MobileHeader() {
  const t = useTranslations();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const hidden = useHideOnScroll();
  const { isVisible } = useLargeTitle();
  const pathname = usePathname();

  const pageTitle = getPageTitle(pathname, (k) => t(`nav.${k}`));

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 left-0 right-0 z-50 glass backdrop-blur-md",
        "px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]",
        "flex items-center justify-between",
        "border-b transition-[border-color,transform] duration-300 ease-out-expo",
        hidden ? "-translate-y-full" : "translate-y-0",
        // Separator only appears once the large title is behind the bar (iOS behaviour)
        isVisible ? "border-transparent" : "border-border/50",
      )}
    >
      {/* Left: logo + app name — fades away when the large title scrolls out */}
      <div
        className={cn(
          "flex items-center gap-2 min-w-0 transition-all duration-300 ease-out-expo",
          !isVisible && "opacity-0 pointer-events-none -translate-y-1 scale-95",
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="none"
          className="h-6 w-6 shrink-0 drop-shadow-lg dark:drop-shadow-[0_3px_10px_rgba(52,211,153,0.25)]"
        >
          <defs>
            <linearGradient id="mobile-icon-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#065f46" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="9" fill="url(#mobile-icon-g)" />
          <path
            d="M8 20 L13.5 13.5 L17.5 17.5 L24 10"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 10 L24 10 L24 14"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent truncate">
            {t("app.name")}
          </h1>
          <p className="text-[10px] text-muted-foreground font-medium -mt-1 opacity-80 uppercase tracking-wide truncate">
            {t("app.subtitleMobile")}
          </p>
        </div>
      </div>

      {/* Centre: small page title — slides in when the large title collapses */}
      <span
        aria-hidden={isVisible}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold text-foreground",
          "transition-all duration-300 ease-out-expo pointer-events-none select-none",
          isVisible ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        )}
      >
        {pageTitle}
      </span>

      {/* Right: controls — always visible */}
      <div className="flex items-center gap-1 scale-90 origin-right">
        <button
          onClick={togglePrivacyMode}
          title={privacyMode ? "Show values" : "Hide values"}
          aria-label={privacyMode ? "Show values" : "Hide values"}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
