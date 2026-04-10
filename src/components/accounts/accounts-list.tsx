"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currencies";
import { AccountForm } from "./account-form";
import { QuickAddHolding } from "./quick-add-holding";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Search, Wallet2, Landmark, ChevronDown, ChevronUp } from "lucide-react";
import type { SerializedAccountWithHoldings } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  BANK: "🏦",
  BROKERAGE: "📈",
  CRYPTO_WALLET: "🪙",
  PROPERTY: "🏠",
  VEHICLE: "🚗",
  CREDIT_CARD: "💳",
  LOAN: "📋",
  MORTGAGE: "🏡",
  OTHER: "📁",
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BANK: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
  BROKERAGE: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300" },
  CRYPTO_WALLET: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
  PROPERTY: { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300" },
  VEHICLE: { bg: "bg-slate-50 dark:bg-slate-950/30", border: "border-slate-200 dark:border-slate-800", text: "text-slate-700 dark:text-slate-300" },
  CREDIT_CARD: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" },
  LOAN: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
  MORTGAGE: { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300" },
  OTHER: { bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-200 dark:border-gray-800", text: "text-gray-700 dark:text-gray-300" },
};

const CATEGORY_ORDER = [
  "BANK", "BROKERAGE", "CRYPTO_WALLET", "PROPERTY", "VEHICLE",
  "CREDIT_CARD", "LOAN", "MORTGAGE", "OTHER",
];

function getAccountValue(
  account: SerializedAccountWithHoldings,
  priceMap: Record<string, number>,
  ratesMap: Record<string, number>
): number {
  const holdingsValue = account.holdings.reduce((sum, h) => {
    const price = (priceMap || {})[h.symbol] ?? 0;
    const hc = h.currency || "USD";
    const rate = hc === account.currency ? 1 : ratesMap[`${hc}_${account.currency}`] ?? 1;
    return sum + price * h.quantity * rate;
  }, 0);
  return account.cashBalance + holdingsValue;
}

export function AccountsList({
  accounts,
  priceMap,
  ratesMap = {},
  baseCurrency = "USD",
}: {
  accounts: SerializedAccountWithHoldings[];
  priceMap: Record<string, number>;
  ratesMap?: Record<string, number>;
  baseCurrency?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ASSET" | "LIABILITY">("ALL");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const all = new Set<string>();
    for (const a of accounts) all.add(`${a.type}_${a.category}`);
    return all;
  });

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((account) => {
      if (typeFilter !== "ALL" && account.type !== typeFilter) return false;
      if (!normalizedQuery) return true;

      const matchesAccount =
        account.name.toLowerCase().includes(normalizedQuery) ||
        account.category.toLowerCase().includes(normalizedQuery) ||
        account.currency.toLowerCase().includes(normalizedQuery);
      if (matchesAccount) return true;

      return account.holdings.some((holding) =>
        `${holding.symbol} ${holding.name}`.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [accounts, query, typeFilter]);

  const assets = filteredAccounts.filter((a) => a.type === "ASSET");
  const liabilities = filteredAccounts.filter((a) => a.type === "LIABILITY");

  const totalAssets = useMemo(
    () =>
      assets.reduce((sum, account) => {
        const value = getAccountValue(account, priceMap, ratesMap);
        const rate = account.currency === baseCurrency ? 1 : ratesMap[`${account.currency}_${baseCurrency}`] ?? 1;
        return sum + value * rate;
      }, 0),
    [assets, priceMap, ratesMap, baseCurrency]
  );

  const totalLiabilities = useMemo(
    () =>
      liabilities.reduce((sum, account) => {
        const value = getAccountValue(account, priceMap, ratesMap);
        const rate = account.currency === baseCurrency ? 1 : ratesMap[`${account.currency}_${baseCurrency}`] ?? 1;
        return sum + value * rate;
      }, 0),
    [liabilities, priceMap, ratesMap, baseCurrency]
  );

  const assetsByCategory = useMemo(() => {
    const grouped: Record<string, SerializedAccountWithHoldings[]> = {};
    for (const account of assets) {
      if (!grouped[account.category]) grouped[account.category] = [];
      grouped[account.category].push(account);
    }
    return CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0)
      .map((cat) => ({ category: cat, accounts: grouped[cat] }));
  }, [assets]);

  const liabilitiesByCategory = useMemo(() => {
    const grouped: Record<string, SerializedAccountWithHoldings[]> = {};
    for (const account of liabilities) {
      if (!grouped[account.category]) grouped[account.category] = [];
      grouped[account.category].push(account);
    }
    return CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0)
      .map((cat) => ({ category: cat, accounts: grouped[cat] }));
  }, [liabilities]);

  function toggleCategory(type: string, category: string) {
    const key = `${type}_${category}`;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visibleIds = filteredAccounts.map((a) => a.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleIds));
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(t("accountsList.deleteConfirm", { count: selected.size }))) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("accountsList.deleteSuccess", { count: selected.size }));
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error(t("accountsList.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const isSelecting = selected.size > 0;
  const allCategoriesExpanded =
    [...assetsByCategory.map(({ category }) => `ASSET_${category}`), ...liabilitiesByCategory.map(({ category }) => `LIABILITY_${category}`)]
      .every((key) => expandedCategories.has(key));

  function expandOrCollapseAll(expand: boolean) {
    if (!expand) {
      setExpandedCategories(new Set());
      return;
    }
    setExpandedCategories(
      new Set([
        ...assetsByCategory.map(({ category }) => `ASSET_${category}`),
        ...liabilitiesByCategory.map(({ category }) => `LIABILITY_${category}`),
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="card-gradient border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("accountsList.assets")}</span>
              <Wallet2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(totalAssets, baseCurrency)}</p>
          </CardContent>
        </Card>
        <Card className="card-gradient border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("accountsList.liabilities")}</span>
              <Landmark className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(totalLiabilities, baseCurrency)}</p>
          </CardContent>
        </Card>
        <Card className="card-gradient border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("accountsList.netPosition")}</span>
              <span className="text-xs font-medium text-muted-foreground">{baseCurrency}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(totalAssets - totalLiabilities, baseCurrency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("accountsList.searchPlaceholder")}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              {(["ALL", "ASSET", "LIABILITY"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={typeFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(filter)}
                >
                  {t(`accountsList.filters.${filter.toLowerCase()}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t("accountsList.resultsCount", { count: filteredAccounts.length })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => expandOrCollapseAll(!allCategoriesExpanded)}
            >
              {allCategoriesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {allCategoriesExpanded ? t("accountsList.collapseAll") : t("accountsList.expandAll")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {filteredAccounts.length > 0 && (
            <>
              <Checkbox
                checked={filteredAccounts.length > 0 && filteredAccounts.every((account) => selected.has(account.id))}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm text-muted-foreground">
                {isSelecting
                  ? t("accountsList.selected", { count: selected.size })
                  : t("accountsList.selectAll")}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSelecting && (
            <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={deleting}>
              {deleting ? t("accountsList.deleting") : t("accountsList.deleteButton", { count: selected.size })}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowQuickAdd(true)}>
            {t("accountsList.addItem")}
          </Button>
          <Button onClick={() => setShowForm(true)}>{t("accountsList.addAccount")}</Button>
        </div>
      </div>

      {accounts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          {t("accountsList.noAccounts")}
        </p>
      )}

      {accounts.length > 0 && filteredAccounts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          {t("accountsList.noMatches")}
        </p>
      )}

      {assetsByCategory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
            {t("accountsList.assets")}
          </h3>
          <div className="space-y-3">
            {assetsByCategory.map(({ category, accounts: catAccounts }) => (
              <CategorySection
                key={`asset_${category}`}
                type="ASSET"
                category={category}
                accounts={catAccounts}
                priceMap={priceMap}
                ratesMap={ratesMap}
                baseCurrency={baseCurrency}
                isExpanded={expandedCategories.has(`ASSET_${category}`)}
                onToggleExpand={() => toggleCategory("ASSET", category)}
                selected={selected}
                onToggleSelect={toggleSelect}
                isSelecting={isSelecting}
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
            {liabilitiesByCategory.map(({ category, accounts: catAccounts }) => (
              <CategorySection
                key={`liability_${category}`}
                type="LIABILITY"
                category={category}
                accounts={catAccounts}
                priceMap={priceMap}
                ratesMap={ratesMap}
                baseCurrency={baseCurrency}
                isExpanded={expandedCategories.has(`LIABILITY_${category}`)}
                onToggleExpand={() => toggleCategory("LIABILITY", category)}
                selected={selected}
                onToggleSelect={toggleSelect}
                isSelecting={isSelecting}
              />
            ))}
          </div>
        </div>
      )}

      <AccountForm open={showForm} onClose={() => setShowForm(false)} defaultCurrency={baseCurrency} />
      <QuickAddHolding open={showQuickAdd} onClose={() => setShowQuickAdd(false)} accounts={accounts} defaultCurrency={baseCurrency} />
    </div>
  );
}

function CategorySection({
  type,
  category,
  accounts,
  priceMap,
  ratesMap,
  baseCurrency,
  isExpanded,
  onToggleExpand,
  selected,
  onToggleSelect,
  isSelecting,
}: {
  type: string;
  category: string;
  accounts: SerializedAccountWithHoldings[];
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  baseCurrency: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  isSelecting: boolean;
}) {
  const t = useTranslations();
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
  const icon = CATEGORY_ICONS[category] ?? "📁";
  const label = t(`categories.${category}`, { defaultValue: category });

  const totalInBaseCurrency = useMemo(() => {
    let total = 0;
    for (const account of accounts) {
      const value = getAccountValue(account, priceMap, ratesMap);
      const rate = account.currency === baseCurrency ? 1 : ratesMap[`${account.currency}_${baseCurrency}`] ?? 1;
      total += value * rate;
    }
    return total;
  }, [accounts, priceMap, ratesMap, baseCurrency]);

  const totalHoldings = accounts.reduce((sum, a) => sum + a.holdings.length, 0);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${colors.border} ${isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"}`}>
      <button
        onClick={onToggleExpand}
        className={`w-full text-left px-5 py-4 flex items-center justify-between transition-colors ${colors.bg} hover:brightness-95 dark:hover:brightness-110`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className={`font-semibold text-base ${colors.text}`}>{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("accountsList.nAccounts", { count: accounts.length })}
              {totalHoldings > 0 && category !== "BANK" && (
                <span>{" · "}{t("accountsList.nHoldings", { count: totalHoldings })}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">
              {formatCurrency(totalInBaseCurrency, baseCurrency)}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-4 py-4 space-y-3 bg-background/50">
          {accounts.map((account) => (
            <AccountCardWithHoldings
              key={account.id}
              account={account}
              priceMap={priceMap}
              ratesMap={ratesMap}
              baseCurrency={baseCurrency}
              isSelected={selected.has(account.id)}
              onToggle={() => onToggleSelect(account.id)}
              isSelecting={isSelecting}
            />
          ))}
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
  isSelected,
  onToggle,
  isSelecting,
}: {
  account: SerializedAccountWithHoldings;
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  baseCurrency: string;
  isSelected: boolean;
  onToggle: () => void;
  isSelecting: boolean;
}) {
  const displayValue = getAccountValue(account, priceMap, ratesMap);
  const displayCurrency = account.currency;
  const rate = displayCurrency === baseCurrency ? 1 : (ratesMap[`${displayCurrency}_${baseCurrency}`] ?? 1);
  const convertedValue = displayValue * rate;

  const holdingsWithValue = account.holdings.map((h) => {
    const price = priceMap[h.symbol] ?? null;
    const hc = h.currency || "USD";
    const rate = hc === account.currency ? 1 : ratesMap[`${hc}_${account.currency}`] ?? 1;
    const marketValue = price !== null ? price * h.quantity * rate : null;
    return { ...h, currentPrice: price, marketValue };
  });

  return (
    <div className="relative group">
      <div
        className={`absolute top-3 left-3 z-10 transition-opacity ${isSelecting ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={(e) => e.preventDefault()}
      >
        <Checkbox checked={isSelected} onCheckedChange={onToggle} />
      </div>
      <Link href={`/accounts/${account.id}`}>
        <Card className={`hover:shadow-md transition-all cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""}`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className={isSelecting ? "pl-6" : "group-hover:pl-6 transition-all"}>
                <p className="font-semibold">{account.name}</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {formatCurrency(convertedValue, baseCurrency)}
                  </p>
                  <Badge variant="secondary" className="bg-foreground text-background hover:bg-foreground/90">{baseCurrency}</Badge>
                </div>
                {displayCurrency !== baseCurrency && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-muted-foreground tabular-nums">
                      {formatCurrency(displayValue, displayCurrency)}
                    </p>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">{displayCurrency}</span>
                  </div>
                )}
              </div>
            </div>

            {account.category !== "BANK" && holdingsWithValue.length > 0 && (
              <div className={`mt-3 ${isSelecting ? "pl-6" : "group-hover:pl-6 transition-all"}`}>
                <div className="space-y-1.5">
                  {holdingsWithValue.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-1.5 border-t border-border/40 first:border-t-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-medium text-muted-foreground w-16 flex-shrink-0 truncate">{h.symbol}</span>
                        <span className="text-sm truncate">{h.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {h.assetType === "CRYPTO" ? h.quantity.toFixed(4) : h.quantity.toFixed(2)}
                        </span>
                        <span className="text-sm font-medium tabular-nums w-20 text-right">
                          {h.marketValue !== null ? formatCurrency(h.marketValue, account.currency) : "—"}
                        </span>
                      </div>
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
