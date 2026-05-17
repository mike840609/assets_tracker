"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDensity } from "@/components/layout/density-context";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { springConfig } from "@/lib/motion";
import { getAccountValue, getAccountValueInCurrency, getHoldingMarketValue } from "@/lib/valuation";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_ICONS, HIDDEN_VALUE } from "./account-category-meta";
import type { AccountCategoryGroup, AccountTypeGroup } from "./use-account-list-model";

export function MobileAccountSections({
  assetsByCategory,
  liabilitiesByCategory,
  expandedCategories,
  totalAssets,
  totalLiabilities,
  baseCurrency,
  priceMap,
  ratesMap,
  deletingId,
  onToggleCategory,
  onDelete,
}: {
  assetsByCategory: AccountCategoryGroup[];
  liabilitiesByCategory: AccountCategoryGroup[];
  expandedCategories: Set<string>;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  deletingId: string | null;
  onToggleCategory: (type: AccountTypeGroup, category: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations();
  const hasAccounts = assetsByCategory.length > 0 || liabilitiesByCategory.length > 0;

  return (
    <div className="lg:hidden space-y-6">
      {hasAccounts && (
        <MobileSummaryStrip
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          baseCurrency={baseCurrency}
        />
      )}

      {assetsByCategory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
            {t("accountsList.assets")}
          </h3>
          <div className="space-y-3">
            {assetsByCategory.map(({ category, accounts }) => (
              <CategorySection
                key={`asset_${category}`}
                category={category}
                accounts={accounts}
                priceMap={priceMap}
                ratesMap={ratesMap}
                baseCurrency={baseCurrency}
                isExpanded={expandedCategories.has(`ASSET_${category}`)}
                onToggleExpand={() => onToggleCategory("ASSET", category)}
                onDelete={onDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        </div>
      )}

      {liabilitiesByCategory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
            {t("accountsList.liabilities")}
          </h3>
          <div className="space-y-3">
            {liabilitiesByCategory.map(({ category, accounts }) => (
              <CategorySection
                key={`liability_${category}`}
                category={category}
                accounts={accounts}
                priceMap={priceMap}
                ratesMap={ratesMap}
                baseCurrency={baseCurrency}
                isExpanded={expandedCategories.has(`LIABILITY_${category}`)}
                onToggleExpand={() => onToggleCategory("LIABILITY", category)}
                onDelete={onDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileSummaryStrip({
  totalAssets,
  totalLiabilities,
  baseCurrency,
}: {
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
}) {
  const { privacyMode } = usePrivacyMode();
  const t = useTranslations();
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-3 grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{t("accountsList.assets")}</p>
        <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">
          {privacyMode ? HIDDEN_VALUE : formatCurrency(totalAssets, baseCurrency, true)}
        </p>
      </div>
      <div className="border-x border-border/40">
        <p className="text-xs text-muted-foreground mb-0.5">{t("accountsList.netWorth")}</p>
        <p
          className={`text-sm font-bold tabular-nums ${netWorth >= 0 ? "text-foreground" : "text-destructive"}`}
        >
          {privacyMode ? HIDDEN_VALUE : formatCurrency(netWorth, baseCurrency, true)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{t("accountsList.liabilities")}</p>
        <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
          {privacyMode ? HIDDEN_VALUE : formatCurrency(totalLiabilities, baseCurrency, true)}
        </p>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  accounts,
  priceMap,
  ratesMap,
  baseCurrency,
  isExpanded,
  onToggleExpand,
  onDelete,
  deletingId,
}: {
  category: string;
  accounts: SerializedAccountWithHoldings[];
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  baseCurrency: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
  const icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.OTHER;
  const label = t(`categories.${category}`, { defaultValue: category });

  const totalInBaseCurrency = useMemo(
    () =>
      accounts.reduce(
        (sum, account) =>
          sum + getAccountValueInCurrency(account, priceMap, ratesMap, baseCurrency),
        0,
      ),
    [accounts, baseCurrency, priceMap, ratesMap],
  );

  const totalHoldings = accounts.reduce((sum, account) => sum + account.holdings.length, 0);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all motion-normal ${colors.border} ${isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"}`}
    >
      <button
        onClick={onToggleExpand}
        className={`w-full text-left ${isCompact ? "px-4 py-2.5" : "px-5 py-4"} flex items-center justify-between transition-colors ${colors.bg} hover:brightness-95 dark:hover:brightness-110`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className={`font-semibold text-base ${colors.text}`}>{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("accountsList.nAccounts", { count: accounts.length })}
              {totalHoldings > 0 && category !== "BANK" && (
                <span>
                  {" · "}
                  {t("accountsList.nHoldings", { count: totalHoldings })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">
              {privacyMode ? HIDDEN_VALUE : formatCurrency(totalInBaseCurrency, baseCurrency)}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-muted-foreground transition-transform motion-normal ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      <div
        className={`grid transition-all motion-normal ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div
            className={`${isCompact ? "px-3 py-2.5 space-y-2" : "px-4 py-4 space-y-3"} bg-background/50`}
          >
            <AnimatePresence initial={false}>
              {accounts.map((account) => (
                <motion.div
                  key={account.id}
                  layout={shouldReduceMotion ? false : "position"}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={shouldReduceMotion ? { duration: 0 } : springConfig}
                >
                  <AccountCardWithHoldings
                    account={account}
                    priceMap={priceMap}
                    ratesMap={ratesMap}
                    baseCurrency={baseCurrency}
                    onDelete={onDelete}
                    isDeleting={deletingId === account.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountCardWithHoldings({
  account,
  priceMap,
  ratesMap,
  baseCurrency,
  onDelete,
  isDeleting,
}: {
  account: SerializedAccountWithHoldings;
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  baseCurrency: string;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const t = useTranslations();
  const isCompact = density === "compact";
  const displayValue = getAccountValue(account, priceMap, ratesMap);
  const convertedValue = getAccountValueInCurrency(account, priceMap, ratesMap, baseCurrency);

  const holdingsWithValue = account.holdings.map((holding) => ({
    ...holding,
    currentPrice: priceMap[holding.symbol] ?? null,
    marketValue: getHoldingMarketValue(holding, priceMap, account.currency, ratesMap),
  }));

  const isBank = account.category === "BANK";
  const hasHoldings = !isBank && holdingsWithValue.length > 0;

  const subtitle = hasHoldings
    ? t("accountsList.nHoldings", { count: account.holdings.length }) +
      (account.cashBalance > 0
        ? ` · ${privacyMode ? HIDDEN_VALUE : formatCurrency(account.cashBalance, account.currency)} cash`
        : "")
    : null;

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground transition-opacity"
            disabled={isDeleting}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(account.id)}>
              <Trash2 className="h-4 w-4" />
              {isDeleting ? t("common.deleting") : t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link href={`/accounts/${account.id}`} prefetch={false} transitionTypes={["nav-forward"]}>
        <Card className="hover:shadow-md transition-all cursor-pointer">
          <CardContent className={isCompact ? "pt-3 pb-2" : "pt-5 pb-4"}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{account.name}</p>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-3">
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {privacyMode ? HIDDEN_VALUE : formatCurrency(convertedValue, baseCurrency)}
                </p>
                {account.currency !== baseCurrency ? (
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {privacyMode ? HIDDEN_VALUE : formatCurrency(displayValue, account.currency)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                    {baseCurrency}
                  </p>
                )}
              </div>
            </div>

            {hasHoldings && (
              <div className="mt-3">
                <div className="space-y-1.5">
                  {holdingsWithValue.map((holding) => (
                    <div
                      key={holding.id}
                      className="flex items-center justify-between py-1.5 border-t border-border/40 first:border-t-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-medium text-muted-foreground w-16 flex-shrink-0 truncate">
                          {holding.symbol}
                        </span>
                        <span className="text-sm truncate">{holding.name}</span>
                      </div>
                      <span className="text-sm font-medium tabular-nums w-20 text-right flex-shrink-0">
                        {privacyMode
                          ? HIDDEN_VALUE
                          : holding.marketValue !== null
                            ? formatCurrency(holding.marketValue, account.currency)
                            : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
