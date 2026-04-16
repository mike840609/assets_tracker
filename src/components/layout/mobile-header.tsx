"use client";

import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";

export function MobileHeader() {
  const t = useTranslations("app");
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();

  return (
    <header className="md:hidden sticky top-0 left-0 right-0 z-50 glass backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center justify-between">
      <div className="flex flex-col">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent">
          {t("name")}
        </h1>
        <p className="text-[10px] text-muted-foreground font-medium -mt-1 opacity-80 uppercase tracking-wider">{t("subtitleMobile")}</p>
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
