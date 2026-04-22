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

import { formatCurrency } from "@/lib/currencies";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { NetWorthSummary } from "@/lib/types";

const HIDDEN = "***";

type SortField = "name" | "category" | "value" | "percentage";
type SortOrder = "asc" | "desc";

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortOrder;
}) {
  if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />;
  return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
}

export function AccountsSummary({ summary }: { summary: NetWorthSummary }) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();

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
      return summary.totalAssets > 0 ? (account.totalValueInBaseCurrency / summary.totalAssets) * 100 : 0;
    } else {
      return summary.totalLiabilities > 0 ? (account.totalValueInBaseCurrency / summary.totalLiabilities) * 100 : 0;
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
              ? summary.totalAssets > 0 ? (acc.totalValueInBaseCurrency / summary.totalAssets) * 100 : 0
              : summary.totalLiabilities > 0 ? (acc.totalValueInBaseCurrency / summary.totalLiabilities) * 100 : 0;
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
          <div className="flex items-center">{t("accountsSummary.colAccount")} <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} /></div>
        </TableHead>
        <TableHead onClick={() => handleSort("category")} className="whitespace-normal cursor-pointer select-none hover:bg-muted/50">
          <div className="flex items-center">{t("accountsSummary.colCategory")} <SortIcon field="category" sortField={sortField} sortDirection={sortDirection} /></div>
        </TableHead>
        <TableHead onClick={() => handleSort("percentage")} className="cursor-pointer select-none hover:bg-muted/50 text-right">
          <div className="flex items-center justify-end">{t("accountsSummary.colPercentage")} <SortIcon field="percentage" sortField={sortField} sortDirection={sortDirection} /></div>
        </TableHead>
        <TableHead onClick={() => handleSort("value")} className="cursor-pointer select-none hover:bg-muted/50 text-right">
          <div className="flex items-center justify-end">{t("accountsSummary.colValue", { currency: summary.baseCurrency })} <SortIcon field="value" sortField={sortField} sortDirection={sortDirection} /></div>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderRows = (accounts: typeof summary.accounts) =>
    accounts.map((account) => (
      <TableRow key={account.id} className="group hover:bg-muted/30 transition-colors duration-200 border-border/50">
        <TableCell className="whitespace-normal break-words py-3">
          <Link href={`/accounts/${account.id}`} className="font-medium group-hover:text-primary transition-colors">
            {account.name}
          </Link>
        </TableCell>
        <TableCell className="whitespace-normal text-muted-foreground py-3">
          {t(`categories.${account.category}`, { defaultValue: account.category })}
        </TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums py-3">
          {privacyMode ? "—" : `${getPercentage(account).toFixed(1)}%`}
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums py-3">
          {privacyMode ? HIDDEN : formatCurrency(account.totalValueInBaseCurrency, summary.baseCurrency)}
        </TableCell>
      </TableRow>
    ));

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold tracking-tight">{t("accountsSummary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {assets.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 opacity-80">
              <span className="w-2 h-2 rounded-full bg-primary" /> {t("common.asset")}
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/40 bg-background/30 backdrop-blur-sm">
              <Table className="table-fixed [&_th]:px-3 sm:[&_th]:px-4 [&_td]:px-3 sm:[&_td]:px-4">
                {colGroup}
                {tableHeader}
                <TableBody>{renderRows(assets)}</TableBody>
                <tfoot>
                  <tr className="border-t-[2px] border-border/50 font-semibold bg-muted/10">
                    <td colSpan={2} className="px-3 sm:px-4 py-3 text-sm text-muted-foreground">
                      {t("accountsSummary.total")}
                    </td>
                    <td />
                    <td className="px-3 sm:px-4 py-3 text-right text-base tabular-nums text-primary">
                      {privacyMode ? HIDDEN : formatCurrency(summary.totalAssets, summary.baseCurrency)}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </div>
        )}

        {liabilities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 opacity-80 mt-6">
              <span className="w-2 h-2 rounded-full bg-destructive" /> {t("common.liability")}
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/40 bg-background/30 backdrop-blur-sm">
              <Table className="table-fixed [&_th]:px-3 sm:[&_th]:px-4 [&_td]:px-3 sm:[&_td]:px-4">
                {colGroup}
                {tableHeader}
                <TableBody>{renderRows(liabilities)}</TableBody>
                <tfoot>
                  <tr className="border-t-[2px] border-border/50 font-semibold bg-muted/10">
                    <td colSpan={2} className="px-3 sm:px-4 py-3 text-sm text-muted-foreground">
                      {t("accountsSummary.total")}
                    </td>
                    <td />
                    <td className="px-3 sm:px-4 py-3 text-right text-base tabular-nums text-destructive">
                      {privacyMode ? HIDDEN : formatCurrency(summary.totalLiabilities, summary.baseCurrency)}
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
