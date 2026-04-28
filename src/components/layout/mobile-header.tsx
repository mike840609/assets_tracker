"use client";

import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { usePullToRefreshContext, HANG_OFFSET } from "./pull-to-refresh-context";

export function MobileHeader() {
  const t = useTranslations("app");
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const hidden = useHideOnScroll();
  const { pull, refreshing } = usePullToRefreshContext();

  // true only while the finger is actively dragging (follow without delay)
  const isPulling = pull > 0 && !refreshing;
  const offset = refreshing ? HANG_OFFSET : Math.min(pull, HANG_OFFSET);
  const hasOffset = offset > 0;

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 left-0 right-0 z-50 glass backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center justify-between ease-in-out",
        !hasOffset && hidden && "-translate-y-full",
        isPulling ? "transition-none" : "transition-transform duration-300"
      )}
      style={hasOffset ? { transform: `translateY(${offset}px)` } : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-6 w-6 shrink-0 drop-shadow-lg dark:drop-shadow-[0_3px_10px_rgba(52,211,153,0.25)]">
          <defs>
            <linearGradient id="mobile-icon-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399"/>
              <stop offset="100%" stopColor="#065f46"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="9" fill="url(#mobile-icon-g)"/>
          <path d="M8 20 L13.5 13.5 L17.5 17.5 L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20 10 L24 10 L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent truncate">
            {t("name")}
          </h1>
          <p className="text-[10px] text-muted-foreground font-medium -mt-1 opacity-80 uppercase tracking-wide truncate">{t("subtitleMobile")}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 scale-90 origin-right">
        <button
          onClick={togglePrivacyMode}
          title={privacyMode ? "Show values" : "Hide values"}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
