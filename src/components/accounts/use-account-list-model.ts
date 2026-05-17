"use client";

import { useMemo, useState } from "react";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import { getAccountValueInCurrency } from "@/lib/valuation";
import { CATEGORY_ORDER } from "./account-category-meta";

export type AccountSortKey = "name" | "value";
export type AccountSortDir = "asc" | "desc";
export type AccountTypeGroup = "ASSET" | "LIABILITY";

export type AccountCategoryGroup = {
  category: string;
  accounts: SerializedAccountWithHoldings[];
};

function groupByCategory(accounts: SerializedAccountWithHoldings[]): AccountCategoryGroup[] {
  const grouped: Record<string, SerializedAccountWithHoldings[]> = {};
  for (const account of accounts) {
    if (!grouped[account.category]) grouped[account.category] = [];
    grouped[account.category].push(account);
  }

  return CATEGORY_ORDER.filter((category) => grouped[category]?.length > 0).map((category) => ({
    category,
    accounts: grouped[category],
  }));
}

export function useAccountListModel({
  accounts,
  priceMap,
  ratesMap,
  baseCurrency,
}: {
  accounts: SerializedAccountWithHoldings[];
  priceMap: Record<string, number>;
  ratesMap: Record<string, number>;
  baseCurrency: string;
}) {
  const [sortKey, setSortKey] = useState<AccountSortKey>("value");
  const [sortDir, setSortDir] = useState<AccountSortDir>("desc");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const all = new Set<string>();
    for (const account of accounts) all.add(`${account.type}_${account.category}`);
    return all;
  });

  const assets = useMemo(() => accounts.filter((account) => account.type === "ASSET"), [accounts]);
  const liabilities = useMemo(
    () => accounts.filter((account) => account.type === "LIABILITY"),
    [accounts],
  );

  const accountBaseValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const account of accounts) {
      values[account.id] = getAccountValueInCurrency(account, priceMap, ratesMap, baseCurrency);
    }
    return values;
  }, [accounts, baseCurrency, priceMap, ratesMap]);

  const totalAssets = useMemo(
    () => assets.reduce((sum, account) => sum + (accountBaseValues[account.id] ?? 0), 0),
    [accountBaseValues, assets],
  );
  const totalLiabilities = useMemo(
    () => liabilities.reduce((sum, account) => sum + (accountBaseValues[account.id] ?? 0), 0),
    [accountBaseValues, liabilities],
  );

  const assetsByCategory = useMemo(() => groupByCategory(assets), [assets]);
  const liabilitiesByCategory = useMemo(() => groupByCategory(liabilities), [liabilities]);

  function toggleSort(key: AccountSortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortedAccounts(accountList: SerializedAccountWithHoldings[]) {
    return [...accountList].sort((a, b) => {
      const aVal = sortKey === "value" ? (accountBaseValues[a.id] ?? 0) : a.name.toLowerCase();
      const bVal = sortKey === "value" ? (accountBaseValues[b.id] ?? 0) : b.name.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  function toggleCategory(type: AccountTypeGroup, category: string) {
    const key = `${type}_${category}`;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return {
    sortKey,
    sortDir,
    toggleSort,
    sortedAccounts,
    expandedCategories,
    toggleCategory,
    assets,
    liabilities,
    accountBaseValues,
    totalAssets,
    totalLiabilities,
    assetsByCategory,
    liabilitiesByCategory,
  };
}
