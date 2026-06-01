"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { springConfig } from "@/lib/motion";
import type { NetWorthSummary } from "@/lib/types";

const HIDDEN = "***";

type SortField = "name" | "category" | "value" | "percentage";
type SortOrder = "asc" | "desc";

export function AccountsSummary({ summary }: { summary: NetWorthSummary }) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const reduceMotion = useReducedMotion();

  // Allocation bars grow from 0 → their share once, the frame after mount, so
  // proportion reads as a quick fill (the existing transition-[width] carries it).
  // Skipped under reduced motion: bars render at full width immediately.
  const [barsGrown, setBarsGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarsGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "value" || field === "percentage" ? "desc" : "asc");
    }
  };

  const getPercentage = (account: (typeof summary.accounts)[number]) => {
    if (account.type === "ASSET") {
      return summary.totalAssets > 0
        ? (account.totalValueInBaseCurrency / summary.totalAssets) * 100
        : 0;
    } else {
      return summary.totalLiabilities > 0
        ? (account.totalValueInBaseCurrency / summary.totalLiabilities) * 100
        : 0;
    }
  };

  const { assets, liabilities } = useMemo(() => {
    const doSort = (accounts: typeof summary.accounts) =>
      [...accounts].sort((a, b) => {
        let comparison = 0;
        if (sortField === "name") {
          comparison = a.name.localeCompare(b.name);
        } else if (sortField === "category") {
          const catA = t(`categories.${a.category}`, { defaultValue: a.category });
          const catB = t(`categories.${b.category}`, { defaultValue: b.category });
          comparison = catA.localeCompare(catB);
        } else if (sortField === "value") {
          comparison = a.totalValueInBaseCurrency - b.totalValueInBaseCurrency;
        } else if (sortField === "percentage") {
          const getPct = (acc: typeof a) =>
            acc.type === "ASSET"
              ? summary.totalAssets > 0
                ? (acc.totalValueInBaseCurrency / summary.totalAssets) * 100
                : 0
              : summary.totalLiabilities > 0
                ? (acc.totalValueInBaseCurrency / summary.totalLiabilities) * 100
                : 0;
          comparison = getPct(a) - getPct(b);
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });
    return {
      assets: doSort(summary.accounts.filter((a) => a.type === "ASSET")),
      liabilities: doSort(summary.accounts.filter((a) => a.type === "LIABILITY")),
    };
  }, [summary, sortField, sortDirection, t]);

  if (summary.accounts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            {t("accountsSummary.noAccounts")}{" "}
            <Link href="/accounts" className="text-primary underline">
              {t("accountsSummary.addFirstAccount")}
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortOptions: { field: SortField; label: string }[] = [
    { field: "value", label: t("accountsSummary.colValue", { currency: summary.baseCurrency }) },
    { field: "name", label: t("accountsSummary.colAccount") },
    { field: "percentage", label: t("accountsSummary.colPercentage") },
    { field: "category", label: t("accountsSummary.colCategory") },
  ];

  const renderGroup = (accounts: typeof summary.accounts, isAsset: boolean) => {
    const totalDisplay = isAsset ? summary.totalAssets : summary.totalLiabilities;
    const label = isAsset ? t("common.asset").toUpperCase() : t("common.liability").toUpperCase();
    const accentClass = isAsset ? "text-[var(--gain)]" : "text-[var(--loss)]";
    const dotClass = isAsset ? "bg-[var(--gain)]" : "bg-[var(--loss)]";
    const totalAccentClass = isAsset ? "text-[var(--gain)]" : "text-[var(--loss)]";

    return (
      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 opacity-70 ${accentClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          {label}
        </p>
        <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
          {accounts.map((account, index) => (
            <motion.div key={account.id} layout={!reduceMotion} transition={springConfig}>
              {index > 0 && <div className="h-px bg-border/60 mx-4" />}
              <div className="relative overflow-hidden">
                {!privacyMode && (
                  <div
                    className={`absolute inset-y-0 left-0 ${isAsset ? "bg-[var(--gain)]/5" : "bg-[var(--loss)]/5"} transition-[width] duration-500 ease-out`}
                    style={{ width: `${reduceMotion || barsGrown ? getPercentage(account) : 0}%` }}
                  />
                )}
                <Link
                  href={`/accounts/${account.id}`}
                  prefetch={false}
                  className={`relative flex items-center gap-3 px-4 ${isCompact ? "py-1.5" : "py-3.5"} hover:bg-muted/40 active:bg-muted/60 transition-colors group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset`}
                  transitionTypes={["nav-forward"]}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {account.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(`categories.${account.category}`, { defaultValue: account.category })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {privacyMode
                          ? HIDDEN
                          : formatCurrency(account.totalValueInBaseCurrency, summary.baseCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                        {privacyMode ? "—" : `${getPercentage(account).toFixed(1)}%`}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </div>
                </Link>
              </div>
            </motion.div>
          ))}
          <div className="h-px bg-border/60" />
          <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              {t("accountsSummary.total")}
            </span>
            <span className={`text-sm font-semibold tabular-nums ${totalAccentClass}`}>
              {privacyMode ? HIDDEN : formatCurrency(totalDisplay, summary.baseCurrency)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="font-heading text-base leading-snug font-medium">
          {t("accountsSummary.title")}
        </h2>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
          {sortOptions.map(({ field, label }) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              aria-pressed={sortField === field}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                sortField === field
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
              {sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
      </div>
      <div className={isCompact ? "space-y-2" : "space-y-6"}>
        {assets.length > 0 && renderGroup(assets, true)}
        {liabilities.length > 0 && renderGroup(liabilities, false)}
      </div>
    </section>
  );
}
