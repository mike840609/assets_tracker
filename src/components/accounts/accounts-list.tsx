"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/currencies";
import { AccountForm } from "./account-form";
import { toast } from "sonner";
import type { SerializedAccountWithHoldings } from "@/lib/types";

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

export function AccountsList({
  accounts,
  priceMap,
}: {
  accounts: SerializedAccountWithHoldings[];
  priceMap: Record<string, number>;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const assets = accounts.filter((a) => a.type === "ASSET");
  const liabilities = accounts.filter((a) => a.type === "LIABILITY");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === accounts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accounts.map((a) => a.id)));
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Delete ${selected.size} account${selected.size !== 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Deleted ${selected.size} account${selected.size !== 1 ? "s" : ""}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Failed to delete accounts");
    } finally {
      setDeleting(false);
    }
  }

  const isSelecting = selected.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {accounts.length > 0 && (
            <>
              <Checkbox
                checked={
                  selected.size === accounts.length && accounts.length > 0
                }
                onCheckedChange={toggleAll}
              />
              <span className="text-sm text-muted-foreground">
                {isSelecting
                  ? `${selected.size} selected`
                  : "Select all"}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSelecting && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelected}
              disabled={deleting}
            >
              {deleting
                ? "Deleting..."
                : `Delete (${selected.size})`}
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}>Add Account</Button>
        </div>
      </div>

      {accounts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No accounts yet. Add your first account to get started.
        </p>
      )}

      {assets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-green-700">Assets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                priceMap={priceMap}
                isSelected={selected.has(account.id)}
                onToggle={() => toggleSelect(account.id)}
                isSelecting={isSelecting}
              />
            ))}
          </div>
        </div>
      )}

      {liabilities.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-red-700">Liabilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liabilities.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                priceMap={priceMap}
                isSelected={selected.has(account.id)}
                onToggle={() => toggleSelect(account.id)}
                isSelecting={isSelecting}
              />
            ))}
          </div>
        </div>
      )}

      <AccountForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

function AccountCard({
  account,
  priceMap,
  isSelected,
  onToggle,
  isSelecting,
}: {
  account: SerializedAccountWithHoldings;
  priceMap: Record<string, number>;
  isSelected: boolean;
  onToggle: () => void;
  isSelecting: boolean;
}) {
  const isBrokerage = account.category === "BROKERAGE" || account.category === "CRYPTO_WALLET";
  const holdingsValue = account.holdings.reduce((sum, h) => {
    const price = (priceMap || {})[h.symbol] ?? 0;
    return sum + price * h.quantity;
  }, 0);
  const displayValue = isBrokerage ? holdingsValue : account.cashBalance;
  const displayCurrency = account.currency;

  return (
    <div className="relative group">
      <div
        className={`absolute top-3 left-3 z-10 transition-opacity ${
          isSelecting ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(e) => e.preventDefault()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
        />
      </div>
      <Link href={`/accounts/${account.id}`}>
        <Card
          className={`hover:shadow-md transition-all cursor-pointer ${
            isSelected ? "ring-2 ring-primary" : ""
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className={isSelecting ? "pl-6" : "group-hover:pl-6 transition-all"}>
                <p className="font-semibold">{account.name}</p>
                <p className="text-sm text-muted-foreground">
                  {CATEGORY_LABELS[account.category] ?? account.category}
                </p>
              </div>
              <Badge variant="secondary">{displayCurrency}</Badge>
            </div>
            <div className={`mt-4 ${isSelecting ? "pl-6" : "group-hover:pl-6 transition-all"}`}>
              <p className="text-xl font-bold">
                {formatCurrency(displayValue, displayCurrency)}
              </p>
              {account.holdings.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {account.holdings.length} holding
                  {account.holdings.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
