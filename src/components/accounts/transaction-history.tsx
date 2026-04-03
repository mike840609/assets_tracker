"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/currencies";
import type { SerializedTransaction } from "@/lib/types";

const TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  BUY: { label: "Buy", variant: "default" },
  SELL: { label: "Sell", variant: "destructive" },
  EDIT: { label: "Edit", variant: "secondary" },
};

export function TransactionHistory({ accountId }: { accountId: string }) {
  const [transactions, setTransactions] = useState<SerializedTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts/${accountId}/transactions`)
      .then((r) => r.json())
      .then((data) => {
        setTransactions(
          data.map((t: Record<string, unknown>) => ({
            ...t,
            quantity: Number(t.quantity),
          }))
        );
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No transactions yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const typeInfo = TYPE_LABELS[t.type] ?? { label: t.type, variant: "secondary" as const };
                const isCrypto = t.holding?.assetType === "CRYPTO";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {t.holding?.symbol ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.quantity > 0 ? "+" : ""}
                      {formatNumber(t.quantity, isCrypto ? 7 : 2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.note || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
