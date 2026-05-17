"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { getAccountValue } from "@/lib/valuation";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_ICONS, HIDDEN_VALUE } from "./account-category-meta";
import type { AccountSortDir, AccountSortKey } from "./use-account-list-model";

export function DesktopAccountsTable({
  assets,
  liabilities,
  sortedAccounts,
  accountBaseValues,
  totalAssets,
  totalLiabilities,
  baseCurrency,
  priceMap,
  ratesMap,
  sortKey,
  sortDir,
  onToggleSort,
  onNavigate,
  onDelete,
  deletingId,
}: {
  assets: SerializedAccountWithHoldings[];
  liabilities: SerializedAccountWithHoldings[];
  sortedAccounts: (accounts: SerializedAccountWithHoldings[]) => SerializedAccountWithHoldings[];
  accountBaseValues: Record<string, number>;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  sortKey: AccountSortKey;
  sortDir: AccountSortDir;
  onToggleSort: (key: AccountSortKey) => void;
  onNavigate: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  deletingId: string | null;
}) {
  const t = useTranslations();

  return (
    <div className="hidden lg:block rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th
              className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-foreground"
              onClick={() => onToggleSort("name")}
            >
              <div className="flex items-center gap-1.5">
                {t("accountsList.colName")}
                <SortIcon active={sortKey === "name"} dir={sortDir} />
              </div>
            </th>
            <th className="px-4 py-3 text-left font-semibold">{t("accountsList.colCategory")}</th>
            <th className="hidden lg:table-cell px-4 py-3 text-left font-semibold w-16">
              {t("accountsList.colCurrency")}
            </th>
            <th className="px-4 py-3 text-left font-semibold">{t("accountsList.colHoldings")}</th>
            <th className="hidden lg:table-cell px-4 py-3 text-right font-semibold">
              {t("accountsList.colNative")}
            </th>
            <th
              className="px-4 py-3 text-right font-semibold cursor-pointer select-none hover:text-foreground"
              onClick={() => onToggleSort("value")}
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
                  onNavigate={() => onNavigate(account.id)}
                  onDelete={onDelete}
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
                  onNavigate={() => onNavigate(account.id)}
                  onDelete={onDelete}
                  isDeleting={deletingId === account.id}
                  allocationDenominator={totalLiabilities}
                />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: AccountSortDir }) {
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
  const icon = CATEGORY_ICONS[account.category] ?? CATEGORY_ICONS.OTHER;
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
          HIDDEN_VALUE
        ) : (
          formatCurrency(nativeValue, account.currency)
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <p className="font-semibold tabular-nums">
          {privacyMode ? HIDDEN_VALUE : formatCurrency(baseValue, baseCurrency)}
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
