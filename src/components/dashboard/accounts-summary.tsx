"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currencies";
import { useTranslations } from "next-intl";
import type { NetWorthSummary } from "@/lib/types";

type SortField = "name" | "category" | "value" | "percentage";
type SortOrder = "asc" | "desc";

export function AccountsSummary({ summary }: { summary: NetWorthSummary }) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");
  const t = useTranslations();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "value" || field === "percentage" ? "desc" : "asc");
    }
  };

  const getPercentage = (account: any) => {
    if (account.type === "ASSET") {
      return summary.totalAssets > 0 ? (account.totalValueInBaseCurrency / summary.totalAssets) * 100 : 0;
    } else {
      return summary.totalLiabilities > 0 ? (account.totalValueInBaseCurrency / summary.totalLiabilities) * 100 : 0;
    }
  };

  const sortAccounts = (accounts: typeof summary.accounts) => {
    return [...accounts].sort((a, b) => {
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
        comparison = getPercentage(a) - getPercentage(b);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const { assets, liabilities } = useMemo(() => {
    const assets = sortAccounts(summary.accounts.filter((a) => a.type === "ASSET"));
    const liabilities = sortAccounts(summary.accounts.filter((a) => a.type === "LIABILITY"));
    return { assets, liabilities };
  }, [summary.accounts, sortField, sortDirection, summary.totalAssets, summary.totalLiabilities]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

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

  const colGroup = (
    <colgroup>
      <col className="w-[32%]" />
      <col className="w-[23%]" />
      <col className="w-[15%]" />
      <col className="w-[30%]" />
    </colgroup>
  );

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead onClick={() => handleSort("name")} className="whitespace-normal cursor-pointer select-none hover:bg-muted/50">
          <div className="flex items-center">{t("accountsSummary.colAccount")} <SortIcon field="name" /></div>
        </TableHead>
        <TableHead onClick={() => handleSort("category")} className="whitespace-normal cursor-pointer select-none hover:bg-muted/50">
          <div className="flex items-center">{t("accountsSummary.colCategory")} <SortIcon field="category" /></div>
        </TableHead>
        <TableHead onClick={() => handleSort("percentage")} className="cursor-pointer select-none hover:bg-muted/50 text-right">
          <div className="flex items-center justify-end">{t("accountsSummary.colPercentage")} <SortIcon field="percentage" /></div>
        </TableHead>
        <TableHead onClick={() => handleSort("value")} className="cursor-pointer select-none hover:bg-muted/50 text-right">
          <div className="flex items-center justify-end">{t("accountsSummary.colValue", { currency: summary.baseCurrency })} <SortIcon field="value" /></div>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderRows = (accounts: typeof summary.accounts) =>
    accounts.map((account) => (
      <TableRow key={account.id}>
        <TableCell className="whitespace-normal break-words">
          <Link href={`/accounts/${account.id}`} className="font-medium hover:underline">
            {account.name}
          </Link>
        </TableCell>
        <TableCell className="whitespace-normal text-muted-foreground">
          {t(`categories.${account.category}`, { defaultValue: account.category })}
        </TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums">
          {getPercentage(account).toFixed(1)}%
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">
          {formatCurrency(account.totalValueInBaseCurrency, summary.baseCurrency)}
        </TableCell>
      </TableRow>
    ));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("accountsSummary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assets.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 px-1">
              {t("common.asset")}
            </p>
            <div className="overflow-x-auto">
              <Table className="table-fixed [&_th]:px-1 sm:[&_th]:px-2 [&_td]:px-1 sm:[&_td]:px-2">
                {colGroup}
                {tableHeader}
                <TableBody>{renderRows(assets)}</TableBody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={2} className="px-1 sm:px-4 py-2 text-sm text-muted-foreground">
                      {t("accountsSummary.total")}
                    </td>
                    <td />
                    <td className="px-1 sm:px-4 py-2 text-right text-sm tabular-nums">
                      {formatCurrency(summary.totalAssets, summary.baseCurrency)}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </div>
        )}

        {liabilities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide mb-1 px-1">
              {t("common.liability")}
            </p>
            <div className="overflow-x-auto">
              <Table className="table-fixed [&_th]:px-1 sm:[&_th]:px-2 [&_td]:px-1 sm:[&_td]:px-2">
                {colGroup}
                {tableHeader}
                <TableBody>{renderRows(liabilities)}</TableBody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={2} className="px-1 sm:px-4 py-2 text-sm text-muted-foreground">
                      {t("accountsSummary.total")}
                    </td>
                    <td />
                    <td className="px-1 sm:px-4 py-2 text-right text-sm tabular-nums">
                      {formatCurrency(summary.totalLiabilities, summary.baseCurrency)}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
