"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/currencies";
import { springConfig } from "@/lib/motion";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { SerializedAccountWithHoldings } from "@/lib/types";

const AccountForm = dynamic(() => import("./account-form").then((m) => m.AccountForm));

const QuickAddHolding = dynamic(() => import("./quick-add-holding").then((m) => m.QuickAddHolding));

const HIDDEN = "***";

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
  BANK: {
    bg: "bg-blue-50 dark:bg-blue-950/60",
    border: "border-blue-200 dark:border-blue-800/40",
    text: "text-blue-700 dark:text-blue-300",
  },
  BROKERAGE: {
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    border: "border-emerald-200 dark:border-emerald-800/40",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  CRYPTO_WALLET: {
    bg: "bg-amber-50 dark:bg-amber-950/60",
    border: "border-amber-200 dark:border-amber-800/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  PROPERTY: {
    bg: "bg-violet-50 dark:bg-violet-950/60",
    border: "border-violet-200 dark:border-violet-800/40",
    text: "text-violet-700 dark:text-violet-300",
  },
  VEHICLE: {
    bg: "bg-slate-50 dark:bg-slate-950/60",
    border: "border-slate-200 dark:border-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
  },
  CREDIT_CARD: {
    bg: "bg-red-50 dark:bg-red-950/60",
    border: "border-red-200 dark:border-red-800/40",
    text: "text-red-700 dark:text-red-300",
  },
  LOAN: {
    bg: "bg-orange-50 dark:bg-orange-950/60",
    border: "border-orange-200 dark:border-orange-800/40",
    text: "text-orange-700 dark:text-orange-300",
  },
  MORTGAGE: {
    bg: "bg-pink-50 dark:bg-pink-950/60",
    border: "border-pink-200 dark:border-pink-800/40",
    text: "text-pink-700 dark:text-pink-300",
  },
  OTHER: {
    bg: "bg-gray-50 dark:bg-gray-950/60",
    border: "border-gray-200 dark:border-gray-800/40",
    text: "text-gray-700 dark:text-gray-300",
  },
};

const CATEGORY_ORDER = [
  "BANK",
  "BROKERAGE",
  "CRYPTO_WALLET",
  "PROPERTY",
  "VEHICLE",
  "CREDIT_CARD",
  "LOAN",
  "MORTGAGE",
  "OTHER",
];

function getAccountValue(
  account: SerializedAccountWithHoldings,
  priceMap: Record<string, number>,
  ratesMap: Record<string, number>,
): number {
  const holdingsValue = account.holdings.reduce((sum, h) => {
    const price = (priceMap || {})[h.symbol] ?? 0;
    const hc = h.currency || "USD";
    const rate = hc === account.currency ? 1 : (ratesMap[`${hc}_${account.currency}`] ?? 1);
    const multiplier = h.assetType === "OPTION" ? (h.contractMultiplier ?? 100) : 1;
    return sum + price * h.quantity * multiplier * rate;
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

  useEffect(() => {
    const handler = () => setShowForm(true);
    window.addEventListener("new-item", handler);
    return () => window.removeEventListener("new-item", handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowQuickAdd(true);
    window.addEventListener("add-item", handler);
    return () => window.removeEventListener("add-item", handler);
  }, []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "value">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const all = new Set<string>();
    for (const a of accounts) all.add(`${a.type}_${a.category}`);
    return all;
  });

  const assets = accounts.filter((a) => a.type === "ASSET");
  const liabilities = accounts.filter((a) => a.type === "LIABILITY");

  const accountBaseValues = useMemo(() => {
    const map: Record<string, number> = {};
    for (const account of accounts) {
      const value = getAccountValue(account, priceMap, ratesMap);
      const rate =
        account.currency === baseCurrency
          ? 1
          : (ratesMap[`${account.currency}_${baseCurrency}`] ?? 1);
      map[account.id] = value * rate;
    }
    return map;
  }, [accounts, priceMap, ratesMap, baseCurrency]);

  function toggleSort(key: "name" | "value") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortedAccounts(accts: SerializedAccountWithHoldings[]) {
    return [...accts].sort((a, b) => {
      const aVal = sortKey === "value" ? (accountBaseValues[a.id] ?? 0) : a.name.toLowerCase();
      const bVal = sortKey === "value" ? (accountBaseValues[b.id] ?? 0) : b.name.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalAssets = useMemo(
    () => assets.reduce((s, a) => s + (accountBaseValues[a.id] ?? 0), 0),
    [assets, accountBaseValues],
  );
  const totalLiabilities = useMemo(
    () => liabilities.reduce((s, a) => s + (accountBaseValues[a.id] ?? 0), 0),
    [liabilities, accountBaseValues],
  );

  const assetsByCategory = useMemo(() => {
    const grouped: Record<string, SerializedAccountWithHoldings[]> = {};
    for (const account of assets) {
      if (!grouped[account.category]) grouped[account.category] = [];
      grouped[account.category].push(account);
    }
    return CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => ({
      category: cat,
      accounts: grouped[cat],
    }));
  }, [assets]);

  const liabilitiesByCategory = useMemo(() => {
    const grouped: Record<string, SerializedAccountWithHoldings[]> = {};
    for (const account of liabilities) {
      if (!grouped[account.category]) grouped[account.category] = [];
      grouped[account.category].push(account);
    }
    return CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => ({
      category: cat,
      accounts: grouped[cat],
    }));
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

  async function deleteAccount(id: string) {
    if (!confirm(t("accountsList.deleteConfirm"))) return;

    setDeletingId(id);
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("accountsList.deleteSuccess"));
      router.refresh();
    } catch {
      toast.error(t("accountsList.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowQuickAdd(true)}>
          {t("accountsList.addItem")}
        </Button>
        <Button onClick={() => setShowForm(true)}>{t("accountsList.addAccount")}</Button>
      </div>

      {accounts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("accountsList.noAccounts")}</p>
      )}

      {/* Desktop table — lg+ */}
      {accounts.length > 0 && (
        <div className="hidden lg:block rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th
                  className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1.5">
                    {t("accountsList.colName")}
                    <SortIcon active={sortKey === "name"} dir={sortDir} />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("accountsList.colCategory")}
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-left font-semibold w-16">
                  {t("accountsList.colCurrency")}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("accountsList.colHoldings")}
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-right font-semibold">
                  {t("accountsList.colNative")}
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("value")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    {t("accountsList.colValue")}
                    <SortIcon active={sortKey === "value"} dir={sortDir} />
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-right font-semibold w-24">
                  {t("accountsList.colAllocation")}
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {assets.length > 0 && (
                <>
                  <tr className="bg-green-50/60 dark:bg-green-950/20">
                    <td
                      colSpan={8}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400"
                    >
                      {t("accountsList.assets")}
                    </td>
                  </tr>
                  {sortedAccounts(assets).map((account) => (
                    <DesktopAccountRow
                      key={account.id}
                      account={account}
                      baseValue={accountBaseValues[account.id] ?? 0}
                      baseCurrency={baseCurrency}
                      priceMap={priceMap}
                      ratesMap={ratesMap}
                      onNavigate={() => router.push(`/accounts/${account.id}`)}
                      onDelete={deleteAccount}
                      isDeleting={deletingId === account.id}
                      allocationDenominator={totalAssets}
                    />
                  ))}
                </>
              )}
              {liabilities.length > 0 && (
                <>
                  <tr className="bg-red-50/60 dark:bg-red-950/20">
                    <td
                      colSpan={8}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-700 dark:text-red-400"
                    >
                      {t("accountsList.liabilities")}
                    </td>
                  </tr>
                  {sortedAccounts(liabilities).map((account) => (
                    <DesktopAccountRow
                      key={account.id}
                      account={account}
                      baseValue={accountBaseValues[account.id] ?? 0}
                      baseCurrency={baseCurrency}
                      priceMap={priceMap}
                      ratesMap={ratesMap}
                      onNavigate={() => router.push(`/accounts/${account.id}`)}
                      onDelete={deleteAccount}
                      isDeleting={deletingId === account.id}
                      allocationDenominator={totalLiabilities}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card view — hidden on lg+ */}
      <div className="lg:hidden space-y-6">
        {accounts.length > 0 && (
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
              {assetsByCategory.map(({ category, accounts: catAccounts }) => (
                <CategorySection
                  key={`asset_${category}`}
                  category={category}
                  accounts={catAccounts}
                  priceMap={priceMap}
                  ratesMap={ratesMap}
                  baseCurrency={baseCurrency}
                  isExpanded={expandedCategories.has(`ASSET_${category}`)}
                  onToggleExpand={() => toggleCategory("ASSET", category)}
                  onDelete={deleteAccount}
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
              {liabilitiesByCategory.map(({ category, accounts: catAccounts }) => (
                <CategorySection
                  key={`liability_${category}`}
                  category={category}
                  accounts={catAccounts}
                  priceMap={priceMap}
                  ratesMap={ratesMap}
                  baseCurrency={baseCurrency}
                  isExpanded={expandedCategories.has(`LIABILITY_${category}`)}
                  onToggleExpand={() => toggleCategory("LIABILITY", category)}
                  onDelete={deleteAccount}
                  deletingId={deletingId}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <AccountForm
          open={showForm}
          onClose={() => setShowForm(false)}
          defaultCurrency={baseCurrency}
        />
      )}
      {showQuickAdd && (
        <QuickAddHolding
          open={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          accounts={accounts}
          defaultCurrency={baseCurrency}
        />
      )}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5" />
  );
}

function DesktopAccountRow({
  account,
  baseValue,
  baseCurrency,
  priceMap,
  ratesMap,
  onNavigate,
  onDelete,
  isDeleting,
  allocationDenominator,
}: {
  account: SerializedAccountWithHoldings;
  baseValue: number;
  baseCurrency: string;
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  onNavigate: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  allocationDenominator: number;
}) {
  const { privacyMode } = usePrivacyMode();
  const t = useTranslations();
  const colors = CATEGORY_COLORS[account.category] ?? CATEGORY_COLORS.OTHER;
  const icon = CATEGORY_ICONS[account.category] ?? "📁";
  const label = t(`categories.${account.category}`, { defaultValue: account.category });
  const nativeValue = getAccountValue(account, priceMap, ratesMap);
  const isSameCurrency = account.currency === baseCurrency;
  const pct =
    allocationDenominator > 0 ? (Math.abs(baseValue) / allocationDenominator) * 100 : null;

  return (
    <tr className="group hover:bg-muted/40 cursor-pointer transition-colors" onClick={onNavigate}>
      <td className="px-4 py-3.5 font-medium max-w-[220px] xl:max-w-[280px]">
        <span className="truncate block" title={account.name}>
          {account.name}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.border} ${colors.text}`}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </span>
      </td>
      <td className="hidden lg:table-cell px-4 py-3.5 text-xs font-mono text-muted-foreground w-16">
        {account.currency}
      </td>
      <td className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums">
        {account.holdings.length > 0 ? (
          t("accountsList.nHoldings", { count: account.holdings.length })
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="hidden lg:table-cell px-4 py-3.5 text-right text-sm text-muted-foreground tabular-nums">
        {isSameCurrency ? (
          <span className="text-muted-foreground/40">—</span>
        ) : privacyMode ? (
          HIDDEN
        ) : (
          formatCurrency(nativeValue, account.currency)
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <p className="font-semibold tabular-nums">
          {privacyMode ? HIDDEN : formatCurrency(baseValue, baseCurrency)}
        </p>
      </td>
      <td className="hidden lg:table-cell px-4 py-3.5 text-right w-24">
        <div className="flex flex-col items-end gap-1">
          <span className="tabular-nums text-xs text-muted-foreground">
            {privacyMode ? "—" : pct !== null ? `${pct.toFixed(1)}%` : "—"}
          </span>
          {!privacyMode && pct !== null && (
            <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          )}
        </div>
      </td>
      <td className="px-2 py-3.5 w-10 text-center" onClick={(e) => e.stopPropagation()}>
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
      </td>
    </tr>
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
          {privacyMode ? HIDDEN : formatCurrency(totalAssets, baseCurrency, true)}
        </p>
      </div>
      <div className="border-x border-border/40">
        <p className="text-xs text-muted-foreground mb-0.5">{t("accountsList.netWorth")}</p>
        <p
          className={`text-sm font-bold tabular-nums ${netWorth >= 0 ? "text-foreground" : "text-destructive"}`}
        >
          {privacyMode ? HIDDEN : formatCurrency(netWorth, baseCurrency, true)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{t("accountsList.liabilities")}</p>
        <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
          {privacyMode ? HIDDEN : formatCurrency(totalLiabilities, baseCurrency, true)}
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
  const icon = CATEGORY_ICONS[category] ?? "📁";
  const label = t(`categories.${category}`, { defaultValue: category });

  const totalInBaseCurrency = useMemo(() => {
    let total = 0;
    for (const account of accounts) {
      const value = getAccountValue(account, priceMap, ratesMap);
      const rate =
        account.currency === baseCurrency
          ? 1
          : (ratesMap[`${account.currency}_${baseCurrency}`] ?? 1);
      total += value * rate;
    }
    return total;
  }, [accounts, priceMap, ratesMap, baseCurrency]);

  const totalHoldings = accounts.reduce((sum, a) => sum + a.holdings.length, 0);
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
              {privacyMode ? HIDDEN : formatCurrency(totalInBaseCurrency, baseCurrency)}
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
  const displayCurrency = account.currency;
  const rate =
    displayCurrency === baseCurrency ? 1 : (ratesMap[`${displayCurrency}_${baseCurrency}`] ?? 1);
  const convertedValue = displayValue * rate;

  const holdingsWithValue = account.holdings.map((h) => {
    const price = priceMap[h.symbol] ?? null;
    const hc = h.currency || "USD";
    const hRate = hc === account.currency ? 1 : (ratesMap[`${hc}_${account.currency}`] ?? 1);
    const multiplier = h.assetType === "OPTION" ? (h.contractMultiplier ?? 100) : 1;
    const marketValue = price !== null ? price * h.quantity * multiplier * hRate : null;
    return { ...h, currentPrice: price, marketValue };
  });

  const isBank = account.category === "BANK";
  const hasHoldings = !isBank && holdingsWithValue.length > 0;

  const subtitle = hasHoldings
    ? t("accountsList.nHoldings", { count: account.holdings.length }) +
      (account.cashBalance > 0
        ? ` · ${privacyMode ? HIDDEN : formatCurrency(account.cashBalance, account.currency)} cash`
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
                {/* D: secondary subtitle line */}
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              {/* B: plain value + muted currency text, no badge */}
              <div className="flex flex-col items-end flex-shrink-0 ml-3">
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {privacyMode ? HIDDEN : formatCurrency(convertedValue, baseCurrency)}
                </p>
                {displayCurrency !== baseCurrency ? (
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {privacyMode ? HIDDEN : formatCurrency(displayValue, displayCurrency)}
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
                  {holdingsWithValue.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between py-1.5 border-t border-border/40 first:border-t-0"
                    >
                      {/* C: symbol + name only, no qty column */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-medium text-muted-foreground w-16 flex-shrink-0 truncate">
                          {h.symbol}
                        </span>
                        <span className="text-sm truncate">{h.name}</span>
                      </div>
                      <span className="text-sm font-medium tabular-nums w-20 text-right flex-shrink-0">
                        {privacyMode
                          ? HIDDEN
                          : h.marketValue !== null
                            ? formatCurrency(h.marketValue, account.currency)
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
