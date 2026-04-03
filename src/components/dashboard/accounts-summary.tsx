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
import type { NetWorthSummary } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  BANK: "Bank",
  BROKERAGE: "Brokerage",
  CRYPTO_WALLET: "Crypto",
  PROPERTY: "Property",
  VEHICLE: "Vehicle",
  CREDIT_CARD: "Credit Card",
  LOAN: "Loan",
  MORTGAGE: "Mortgage",
  OTHER: "Other",
};

type SortField = "name" | "category" | "type" | "value" | "percentage";
type SortOrder = "asc" | "desc";

export function AccountsSummary({ summary }: { summary: NetWorthSummary }) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");

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

  const sortedAccounts = useMemo(() => {
    return [...summary.accounts].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "category") {
        const catA = CATEGORY_LABELS[a.category] ?? a.category;
        const catB = CATEGORY_LABELS[b.category] ?? b.category;
        comparison = catA.localeCompare(catB);
      } else if (sortField === "type") {
        comparison = a.type.localeCompare(b.type);
      } else if (sortField === "value") {
        comparison = a.totalValueInBaseCurrency - b.totalValueInBaseCurrency;
      } else if (sortField === "percentage") {
        comparison = getPercentage(a) - getPercentage(b);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
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
            No accounts yet.{" "}
            <Link href="/accounts" className="text-primary underline">
              Add your first account
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">All Accounts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('name')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Account <SortIcon field="name" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('category')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Category <SortIcon field="category" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('type')} className="cursor-pointer select-none hover:bg-muted/50">
                  <div className="flex items-center">Type <SortIcon field="type" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('value')} className="cursor-pointer select-none hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">Value ({summary.baseCurrency}) <SortIcon field="value" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort('percentage')} className="cursor-pointer select-none hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">% <SortIcon field="percentage" /></div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Link
                      href={`/accounts/${account.id}`}
                      className="font-medium hover:underline"
                    >
                      {account.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CATEGORY_LABELS[account.category] ?? account.category}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        account.type === "ASSET" ? "default" : "destructive"
                      }
                    >
                      {account.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(
                      account.totalValueInBaseCurrency,
                      summary.baseCurrency
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {getPercentage(account).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
