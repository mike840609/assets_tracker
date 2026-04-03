"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatNumber } from "@/lib/currencies";
import { HoldingForm } from "./holding-form";
import { EditHoldingDialog } from "./edit-holding-dialog";
import { TransactionHistory } from "./transaction-history";
import { InlineBalanceEditor } from "./inline-balance-editor";
import { toast } from "sonner";
import type { SerializedAccountWithHoldings, SerializedHolding } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  BANK: "Bank",
  BROKERAGE: "Brokerage",
  CRYPTO_WALLET: "Crypto Wallet",
  PROPERTY: "Property",
  VEHICLE: "Vehicle",
  CREDIT_CARD: "Credit Card",
  LOAN: "Loan",
  MORTGAGE: "Mortgage",
  OTHER: "Other",
};

export function AccountDetail({
  account,
  priceMap,
  ratesMap = {},
}: {
  account: SerializedAccountWithHoldings;
  priceMap: Record<string, number>;
  ratesMap?: Record<string, number>;
}) {
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [editingHolding, setEditingHolding] = useState<SerializedHolding | null>(null);
  const [deleting, setDeleting] = useState(false);

  const holdingsWithValue = account.holdings.map((h) => {
    const price = priceMap[h.symbol] ?? null;
    const hc = h.currency || "USD";
    const rate = hc === account.currency ? 1 : ratesMap[`${hc}_${account.currency}`] ?? 1;
    const marketValue = price !== null ? price * h.quantity * rate : null;
    return { ...h, currentPrice: price, marketValue };
  });

  const totalHoldingsValue = holdingsWithValue.reduce(
    (sum, h) => sum + (h.marketValue ?? 0),
    0
  );
  const isBrokerage = account.category === "BROKERAGE" || account.category === "CRYPTO_WALLET";
  const totalValue = account.cashBalance + totalHoldingsValue;

  async function saveBalance(newBalance: number, note?: string) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashBalance: newBalance, note }),
    });
    setRefreshTrigger((prev) => prev + 1);
    toast.success("Balance updated");
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirm("Delete this account? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      toast.success("Account deleted");
      router.push("/accounts");
    } catch {
      toast.error("Failed to delete");
      setDeleting(false);
    }
  }

  async function deleteHolding(holdingId: string) {
    try {
      await fetch(`/api/accounts/${account.id}/holdings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holdingId }),
      });
      toast.success("Holding removed");
      setRefreshTrigger((prev) => prev + 1);
      router.refresh();
    } catch {
      toast.error("Failed to delete holding");
    }
  }

  const isBank = account.category === "BANK";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/accounts" className="hover:text-foreground">
          Accounts
        </Link>
        <span>/</span>
        <span>{account.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{account.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={account.type === "ASSET" ? "default" : "destructive"}>
              {account.type}
            </Badge>
            <span className="text-muted-foreground">
              {CATEGORY_LABELS[account.category]} · {account.currency}
            </span>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={deleteAccount}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete Account"}
        </Button>
      </div>

      {isBrokerage ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Market Value</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(totalHoldingsValue, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Holdings</p>
              <p className="text-2xl font-bold mt-1">
                {holdingsWithValue.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Cash Balance</p>
              <InlineBalanceEditor
                currentBalance={account.cashBalance}
                currency={account.currency}
                notePlaceholder="Note (e.g. Deposit, Salary...)"
                onSave={saveBalance}
              />
            </CardContent>
          </Card>
        </div>
      ) : isBank ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Cash Balance</p>
              <InlineBalanceEditor
                currentBalance={account.cashBalance}
                currency={account.currency}
                notePlaceholder="Note (e.g. Salary, Rent...)"
                onSave={saveBalance}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(totalValue, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Cash Balance</p>
              <InlineBalanceEditor
                currentBalance={account.cashBalance}
                currency={account.currency}
                notePlaceholder="Note (e.g. Salary, Rent...)"
                onSave={saveBalance}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Holdings Value</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(totalHoldingsValue, account.currency)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!isBank && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Holdings</CardTitle>
            <Button size="sm" onClick={() => setShowHoldingForm(true)}>
              Add Holding
            </Button>
          </CardHeader>
          <CardContent>
            {holdingsWithValue.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No holdings yet. Add stocks, ETFs, or crypto.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Ccy</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdingsWithValue.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono font-medium">
                        {h.symbol}
                      </TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{h.assetType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{h.currency || "USD"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(h.quantity, h.assetType === "CRYPTO" ? 7 : 2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {h.currentPrice !== null
                          ? formatCurrency(h.currentPrice, h.currency || "USD")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {h.marketValue !== null
                          ? formatCurrency(h.marketValue, account.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {h.marketValue !== null && totalHoldingsValue > 0
                          ? `${((h.marketValue / totalHoldingsValue) * 100).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 hover:bg-accent hover:text-accent-foreground">
                            ...
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingHolding(h)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteHolding(h.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <TransactionHistory accountId={account.id} isBank={isBank} refreshTrigger={refreshTrigger} />

      <HoldingForm
        open={showHoldingForm}
        onClose={() => setShowHoldingForm(false)}
        accountId={account.id}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {editingHolding && (
        <EditHoldingDialog
          open={!!editingHolding}
          onClose={() => setEditingHolding(null)}
          holding={editingHolding}
          accountId={account.id}
          onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}
    </>
  );
}
