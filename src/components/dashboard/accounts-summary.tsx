"use client";

import Link from "next/link";
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

export function AccountsSummary({ summary }: { summary: NetWorthSummary }) {
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Value ({summary.baseCurrency})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.accounts.map((account) => (
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
                <TableCell className="text-right font-medium">
                  {formatCurrency(
                    account.totalValueInBaseCurrency,
                    summary.baseCurrency
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
