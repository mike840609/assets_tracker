"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, PieChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function DashboardPortfolioDisclosure({ children }: { children: ReactNode }) {
  const t = useTranslations("dashboard");
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <section className="space-y-4 md:space-y-8">
      <button
        type="button"
        data-testid="dashboard-portfolio-disclosure-toggle"
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={t(expanded ? "hidePortfolioDetails" : "showPortfolioDetails")}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PieChart className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-foreground">
            {t("portfolioDetails")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        data-testid="dashboard-portfolio-details"
        className={cn("space-y-4 md:block md:space-y-8", expanded ? "block" : "hidden")}
      >
        {children}
      </div>
    </section>
  );
}
