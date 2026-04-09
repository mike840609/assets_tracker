"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useTranslations } from "next-intl";
import type { SerializedAccountWithHoldings, SerializedHolding } from "@/lib/types";

type HoldingSortField = "symbol" | "name" | "assetType" | "currency" | "quantity" | "currentPrice" | "marketValue" | "percentage";
type SortOrder = "asc" | "desc";

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
  const t = useTranslations();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [editingHolding, setEditingHolding] = useState<SerializedHolding | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(account.name);
  const [deleting, setDeleting] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [sortField, setSortField] = useState<HoldingSortField>("marketValue");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");

  const handleSort = (field: HoldingSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" || field === "symbol" || field === "assetType" || field === "currency" ? "asc" : "desc");
    }
  };

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

  const sortedHoldings = useMemo(() => {
    return [...holdingsWithValue].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "symbol":
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "assetType":
          comparison = a.assetType.localeCompare(b.assetType);
          break;
        case "currency":
          comparison = (a.currency || "USD").localeCompare(b.currency || "USD");
          break;
        case "quantity":
          comparison = a.quantity - b.quantity;
          break;
        case "currentPrice":
          comparison = (a.currentPrice ?? 0) - (b.currentPrice ?? 0);
          break;
        case "marketValue":
        case "percentage":
          comparison = (a.marketValue ?? 0) - (b.marketValue ?? 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [holdingsWithValue, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: HoldingSortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  };
  const isBrokerage = account.category === "BROKERAGE" || account.category === "CRYPTO_WALLET";
  const totalValue = account.cashBalance + totalHoldingsValue;

  async function saveBalance(newBalance: number, note?: string) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashBalance: newBalance, note }),
    });
    setRefreshTrigger((prev) => prev + 1);
    toast.success(t("accountDetail.balanceUpdated"));
    router.refresh();
  }

  async function handleNameSave() {
    if (tempName.trim() === "" || tempName === account.name) {
      setIsEditingName(false);
      setTempName(account.name);
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("accountDetail.updateFailed"));
      }

      toast.success(t("accountDetail.accountUpdated"));
      setIsEditingName(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("accountDetail.updateFailed")
      );
      setTempName(account.name);
      setIsEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  async function deleteAccount() {
    if (!confirm(t("accountDetail.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      toast.success(t("accountDetail.accountDeleted"));
      router.push("/accounts");
    } catch {
      toast.error(t("accountDetail.deleteFailed"));
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
      toast.success(t("accountDetail.holdingRemoved"));
      setRefreshTrigger((prev) => prev + 1);
      router.refresh();
    } catch {
      toast.error(t("accountDetail.holdingDeleteFailed"));
    }
  }

  const isBank = account.category === "BANK";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/accounts" className="hover:text-foreground">
          {t("accountDetail.breadcrumb")}
        </Link>
        <span>/</span>
        <span>{account.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1 mr-4">
          {isEditingName ? (
            <div className="flex items-center gap-2 max-w-md">
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setTempName(account.name);
                  }
                }}
                disabled={savingName}
                className="text-2xl font-bold h-10 px-2"
                autoFocus
              />
            </div>
          ) : (
            <h2
              className="text-2xl font-bold tracking-tight cursor-pointer hover:text-primary hover:bg-accent/50 rounded px-1 -mx-1 transition-colors"
              onClick={() => setIsEditingName(true)}
            >
              {account.name}
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={account.type === "ASSET" ? "default" : "destructive"}>
              {t(`common.${account.type.toLowerCase()}`, { defaultValue: account.type })}
            </Badge>
            <span className="text-muted-foreground">
              {t(`categories.${account.category}`, { defaultValue: account.category })} · {account.currency}
            </span>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={deleteAccount} disabled={deleting}>
          {deleting ? t("accountDetail.deleting") : t("accountDetail.deleteAccount")}
        </Button>
      </div>

      {isBrokerage ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.marketValue")}</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(totalHoldingsValue, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.holdingsCount")}</p>
              <p className="text-2xl font-bold mt-1">{holdingsWithValue.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
              <InlineBalanceEditor
                currentBalance={account.cashBalance}
                currency={account.currency}
                notePlaceholder={t("accountDetail.notePlaceholderDeposit")}
                onSave={saveBalance}
              />
            </CardContent>
          </Card>
        </div>
      ) : isBank ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
              <InlineBalanceEditor
                currentBalance={account.cashBalance}
                currency={account.currency}
                notePlaceholder={t("accountDetail.notePlaceholderSalary")}
                onSave={saveBalance}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.totalValue")}</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(totalValue, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
              <InlineBalanceEditor
                currentBalance={account.cashBalance}
                currency={account.currency}
                notePlaceholder={t("accountDetail.notePlaceholderSalary")}
                onSave={saveBalance}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("accountDetail.holdingsValue")}</p>
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
            <CardTitle className="text-base font-medium">{t("accountDetail.holdingsCount")}</CardTitle>
            <Button size="sm" onClick={() => setShowHoldingForm(true)}>
              {t("accountDetail.addHolding")}
            </Button>
          </CardHeader>
          <CardContent>
            {holdingsWithValue.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {t("accountDetail.noHoldings")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("symbol")}
                    >
                      <div className="flex items-center">{t("accountDetail.colSymbol")} <SortIcon field="symbol" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">{t("accountDetail.colName")} <SortIcon field="name" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("assetType")}
                    >
                      <div className="flex items-center">{t("accountDetail.colType")} <SortIcon field="assetType" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("currency")}
                    >
                      <div className="flex items-center">{t("accountDetail.colCurrency")} <SortIcon field="currency" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("quantity")}
                    >
                      <div className="flex items-center justify-end">{t("accountDetail.colQty")} <SortIcon field="quantity" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("currentPrice")}
                    >
                      <div className="flex items-center justify-end">{t("accountDetail.colPrice")} <SortIcon field="currentPrice" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("marketValue")}
                    >
                      <div className="flex items-center justify-end">{t("accountDetail.colValue")} <SortIcon field="marketValue" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer select-none hover:bg-accent/50"
                      onClick={() => handleSort("percentage")}
                    >
                      <div className="flex items-center justify-end">{t("accountDetail.colPercentage")} <SortIcon field="percentage" /></div>
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHoldings.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono font-medium">{h.symbol}</TableCell>
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
                            <DropdownMenuItem onClick={() => setEditingHolding(h)}>
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteHolding(h.id)}
                            >
                              {t("common.delete")}
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
