"use client";

import { useState, useMemo, startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { springConfig } from "@/lib/motion";

import dynamic from "next/dynamic";
import { EditHoldingDialog } from "./edit-holding-dialog";

const HoldingForm = dynamic(() => import("./holding-form").then((m) => m.HoldingForm), {
  ssr: false,
  loading: () => null,
});

const TransactionHistory = dynamic(
  () => import("./transaction-history").then((m) => m.TransactionHistory),
  {
    ssr: false,
    loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" />,
  },
);
import { AccountStatCards } from "./account-stat-cards";
import { HoldingRow } from "./holding-row";
import type { HoldingWithPrice } from "./holding-row";
import { HoldingsTable, type HoldingSortField } from "./holdings-table";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { SerializedAccountWithHoldings, SerializedHolding } from "@/lib/types";
import { showUndoDeleteToast } from "@/lib/undo-delete";

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

  useEffect(() => {
    const handler = () => setShowHoldingForm(true);
    window.addEventListener("new-item", handler);
    return () => window.removeEventListener("new-item", handler);
  }, []);
  const [editingHolding, setEditingHolding] = useState<SerializedHolding | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(account.name);
  const [deleting, setDeleting] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [sortField, setSortField] = useState<HoldingSortField>("marketValue");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<Set<string>>(new Set());
  const [showAllMobileHoldings, setShowAllMobileHoldings] = useState(false);
  const pendingHoldingDeletes = useRef<Set<string>>(new Set());

  // Commit any in-flight holding deletes if the user refreshes/navigates before the toast expires.
  useEffect(() => {
    function flush() {
      for (const id of pendingHoldingDeletes.current) {
        fetch(`/api/accounts/${account.id}/holdings`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
          keepalive: true,
        });
      }
    }
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [account.id]);

  const handleSort = (field: HoldingSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(
        field === "name" || field === "symbol" || field === "assetType" || field === "currency"
          ? "asc"
          : "desc",
      );
    }
  };

  const shouldReduceMotion = useReducedMotion();

  const holdingsWithValue: HoldingWithPrice[] = account.holdings.map((h) => {
    const price = priceMap[h.symbol] ?? null;
    const hc = h.currency || "USD";
    const rate = hc === account.currency ? 1 : (ratesMap[`${hc}_${account.currency}`] ?? 1);
    const multiplier = h.assetType === "OPTION" ? (h.contractMultiplier ?? 100) : 1;
    const marketValue = price !== null ? price * h.quantity * multiplier * rate : null;
    return { ...h, currentPrice: price, marketValue };
  });

  const totalHoldingsValue = holdingsWithValue.reduce((sum, h) => sum + (h.marketValue ?? 0), 0);

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

  const isBank = account.category === "BANK";
  const filteredSortedHoldings = sortedHoldings.filter((h) => !optimisticHiddenIds.has(h.id));
  const visibleMobileHoldings = showAllMobileHoldings
    ? filteredSortedHoldings
    : filteredSortedHoldings.slice(0, 20);

  async function saveBalance(newBalance: number, note?: string) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashBalance: newBalance, note }),
    });
    setRefreshTrigger((prev) => prev + 1);
    toast.success(t("accountDetail.balanceUpdated"));
    startTransition(() => {
      router.refresh();
    });
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
        throw new Error(err.error?.message || t("accountDetail.updateFailed"));
      }

      toast.success(t("accountDetail.accountUpdated"));
      setIsEditingName(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accountDetail.updateFailed"));
      setTempName(account.name);
      setIsEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  function deleteAccount() {
    setDeleting(true);
    showUndoDeleteToast({
      message: t("accountDetail.accountDeleted"),
      undoLabel: t("common.undo"),
      onUndo: () => setDeleting(false),
      onCommit: async () => {
        try {
          await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
          startTransition(() => {
            router.push("/accounts");
          });
        } catch {
          toast.error(t("accountDetail.deleteFailed"));
          setDeleting(false);
        }
      },
    });
  }

  function deleteHolding(holdingId: string) {
    setOptimisticHiddenIds((prev) => new Set(prev).add(holdingId));
    pendingHoldingDeletes.current.add(holdingId);
    showUndoDeleteToast({
      message: t("accountDetail.holdingRemoved"),
      undoLabel: t("common.undo"),
      onUndo: () => {
        pendingHoldingDeletes.current.delete(holdingId);
        setOptimisticHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(holdingId);
          return next;
        });
      },
      onCommit: async () => {
        pendingHoldingDeletes.current.delete(holdingId);
        try {
          await fetch(`/api/accounts/${account.id}/holdings`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: holdingId }),
          });
          // Keep holdingId in optimisticHiddenIds until router.refresh() delivers
          // fresh props — removing it early can cause a flash from stale data.
          setRefreshTrigger((prev) => prev + 1);
          startTransition(() => {
            router.refresh();
          });
        } catch {
          toast.error(t("accountDetail.holdingDeleteFailed"));
          setOptimisticHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(holdingId);
            return next;
          });
        }
      },
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/accounts" className="hover:text-foreground" transitionTypes={["nav-back"]}>
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
              {t(`categories.${account.category}`, { defaultValue: account.category })} ·{" "}
              {account.currency}
            </span>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={deleteAccount} disabled={deleting}>
          {deleting ? t("accountDetail.deleting") : t("accountDetail.deleteAccount")}
        </Button>
      </div>

      <AccountStatCards
        account={account}
        totalHoldingsValue={totalHoldingsValue}
        onSaveBalance={saveBalance}
      />

      {!isBank && (
        <>
          {/* Mobile: swipeable card rows */}
          <Card className="md:hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  {t("accountDetail.holdingsCount")}
                </CardTitle>
                <Button size="sm" onClick={() => setShowHoldingForm(true)}>
                  {t("accountDetail.addHolding")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {holdingsWithValue.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t("accountDetail.noHoldings")}
                </p>
              ) : (
                <>
                  {holdingsWithValue.length > 1 && (
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className="text-xs text-muted-foreground shrink-0">Sort:</span>
                      {(
                        [
                          {
                            field: "marketValue" as HoldingSortField,
                            label: t("accountDetail.colValue"),
                          },
                          {
                            field: "symbol" as HoldingSortField,
                            label: t("accountDetail.colSymbol"),
                          },
                          {
                            field: "percentage" as HoldingSortField,
                            label: t("accountDetail.colPercentage"),
                          },
                          {
                            field: "quantity" as HoldingSortField,
                            label: t("accountDetail.colQty"),
                          },
                        ] as { field: HoldingSortField; label: string }[]
                      ).map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => handleSort(field)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            sortField === field
                              ? "border-primary/40 bg-primary/10 text-primary font-medium"
                              : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          {label}
                          {sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
                    <AnimatePresence initial={false}>
                      {visibleMobileHoldings.map((h, index) => (
                        <motion.div
                          key={h.id}
                          layout={shouldReduceMotion ? false : "position"}
                          initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                          transition={shouldReduceMotion ? { duration: 0 } : springConfig}
                        >
                          {index > 0 && <div className="h-px bg-border/60 mx-4" />}
                          <HoldingRow
                            holding={h}
                            totalValue={totalHoldingsValue}
                            accountCurrency={account.currency}
                            onEdit={setEditingHolding}
                            onDelete={deleteHolding}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  {!showAllMobileHoldings && filteredSortedHoldings.length > 20 && (
                    <button
                      onClick={() => setShowAllMobileHoldings(true)}
                      className="w-full py-3 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      {t("accountDetail.showMore", { count: filteredSortedHoldings.length - 20 })}
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Desktop: data table */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">
                {t("accountDetail.holdingsCount")}
                {filteredSortedHoldings.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground font-normal">
                    ({filteredSortedHoldings.length})
                  </span>
                )}
              </h3>
              <Button size="sm" onClick={() => setShowHoldingForm(true)}>
                {t("accountDetail.addHolding")}
              </Button>
            </div>
            {filteredSortedHoldings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {t("accountDetail.noHoldings")}
              </p>
            ) : (
              <HoldingsTable
                holdings={filteredSortedHoldings}
                totalValue={totalHoldingsValue}
                accountCurrency={account.currency}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onEdit={setEditingHolding}
                onDelete={deleteHolding}
              />
            )}
          </div>
        </>
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
