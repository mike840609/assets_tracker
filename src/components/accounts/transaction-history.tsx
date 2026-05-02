"use client";

import { useRef, useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import { useTranslations } from "next-intl";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/currencies";
import type { SerializedTransaction } from "@/lib/types";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hapticTick } from "@/lib/haptics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  BUY: "default",
  SELL: "destructive",
  DEPOSIT: "default",
  WITHDRAWAL: "destructive",
  EDIT: "secondary",
};

const ACTION_WIDTH = 72;
const REVEAL_WIDTH = ACTION_WIDTH * 2;
const SNAP_THRESHOLD = REVEAL_WIDTH * 0.4;

interface TxRowProps {
  tx: SerializedTransaction;
  typeLabel: string;
  typeVariant: "default" | "secondary" | "destructive";
  symbol: string | null;
  qty: string;
  time: string;
  onEdit: () => void;
  onDelete: () => void;
  tCommon: ReturnType<typeof useTranslations>;
}

function SwipeableTxRow({ tx, typeLabel, typeVariant, symbol, qty, time, onEdit, onDelete, tCommon }: TxRowProps) {
  const x = useMotionValue(0);
  const hasFiredHaptic = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const actionsOpacity = useTransform(x, [-REVEAL_WIDTH, -REVEAL_WIDTH * 0.25, 0], [1, 0.85, 0]);

  function snapOpen() {
    animate(x, -REVEAL_WIDTH, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(true);
  }

  function snapClose() {
    animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(false);
    hasFiredHaptic.current = false;
  }

  function handleDragEnd() {
    if (x.get() < -SNAP_THRESHOLD) {
      snapOpen();
      hapticTick();
    } else {
      snapClose();
    }
  }

  function handleDrag() {
    const currentX = x.get();
    if (!hasFiredHaptic.current && currentX < -SNAP_THRESHOLD) {
      hapticTick();
      hasFiredHaptic.current = true;
    } else if (hasFiredHaptic.current && currentX > -SNAP_THRESHOLD) {
      hasFiredHaptic.current = false;
    }
  }

  return (
    <div className="relative overflow-hidden bg-card select-none">
      {/* Action buttons revealed on left swipe */}
      <motion.div
        className="absolute inset-y-0 right-0 flex"
        style={{ opacity: actionsOpacity, width: REVEAL_WIDTH }}
        aria-hidden="true"
      >
        <button
          className="flex-1 flex flex-col items-center justify-center bg-blue-500 text-white text-xs font-medium gap-1 active:brightness-90 transition-[filter]"
          onClick={() => { snapClose(); onEdit(); }}
          aria-label={tCommon("edit")}
        >
          <Pencil className="h-4 w-4" />
          <span>{tCommon("edit")}</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center justify-center bg-destructive text-destructive-foreground text-xs font-medium gap-1 active:brightness-90 transition-[filter]"
          onClick={() => { snapClose(); onDelete(); }}
          aria-label={tCommon("delete")}
        >
          <Trash2 className="h-4 w-4" />
          <span>{tCommon("delete")}</span>
        </button>
      </motion.div>

      {/* Draggable row content */}
      <motion.div
        className="flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors relative z-10"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
        dragElastic={{ left: 0.08, right: 0.15 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={() => { if (isOpen) snapClose(); }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {symbol && (
              <span className="font-mono font-semibold text-sm">{symbol}</span>
            )}
            <Badge variant={typeVariant} className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
              {typeLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {time}{tx.note ? ` · ${tx.note}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium tabular-nums">{qty}</p>
        </div>
        {/* Desktop fallback: three-dot menu */}
        <div className="hidden sm:block">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {tCommon("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    </div>
  );
}

export function TransactionHistory({ accountId, isBank, refreshTrigger }: { accountId: string; isBank?: boolean; refreshTrigger?: number }) {
  const router = useRouter();
  const t = useTranslations("transactionHistory");
  const tCommon = useTranslations("common");

  // Dialog state
  const [editingTx, setEditingTx] = useState<SerializedTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<SerializedTransaction | null>(null);

  // Form state
  const [editType, setEditType] = useState("BUY");
  const [editQuantity, setEditQuantity] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetcher = (url: string) => fetch(url).then((res) => res.json()).then((r) => r.data);

  const getKey = (pageIndex: number, previousPageData: SerializedTransaction[]) => {
    if (previousPageData && !previousPageData.length) return null; // reached the end
    return `/api/accounts/${accountId}/transactions?page=${pageIndex + 1}&limit=20`;
  };

  const { data, size, setSize, isValidating, mutate } = useSWRInfinite(getKey, fetcher);

  const transactions = data
    ? data.flat().map((t: { quantity: string | number } & Record<string, unknown>) => ({
        ...t,
        quantity: Number(t.quantity),
      })) as SerializedTransaction[]
    : [];

  const isLoadingInitialData = !data && isValidating;
  const isLoadingMore = isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.length < 20);

  useEffect(() => {
    if (refreshTrigger) {
      mutate();
    }
  }, [refreshTrigger, mutate]);

  const handleEditClick = (t: SerializedTransaction) => {
    setEditingTx(t);
    setEditType(t.type);
    setEditQuantity(String(t.quantity));
    setEditNote(t.note || "");
    
    // Format date for datetime-local input
    const date = new Date(t.createdAt);
    // Convert to local datetime string format YYYY-MM-DDThh:mm
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    setEditDate(localISOTime);
  };

  const handleEditSave = async () => {
    if (!editingTx) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTx.id,
          type: editType,
          quantity: Number(editQuantity),
          note: editNote,
          createdAt: new Date(editDate).toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to update transaction");

      toast.success(t("updateSuccess"));
      setEditingTx(null);
      mutate();
      startTransition(() => { router.refresh(); }); // Refresh holdings on parent page
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTx) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/transactions/${deletingTx.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete transaction");

      toast.success(t("deleteSuccess"));
      setDeletingTx(null);
      mutate();
      startTransition(() => { router.refresh(); }); // Refresh holdings on parent page
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInitialData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">{t("loading")}</p>
        </CardContent>
      </Card>
    );
  }

  const dateGroups = transactions.reduce<{ dateKey: string; items: SerializedTransaction[] }[]>((acc, tx) => {
    const dateKey = new Date(tx.createdAt).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
    const last = acc[acc.length - 1];
    if (last && last.dateKey === dateKey) {
      last.items.push(tx);
    } else {
      acc.push({ dateKey, items: [tx] });
    }
    return acc;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {t("empty")}
          </p>
        ) : (
          dateGroups.map(({ dateKey, items }) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1">
                {dateKey}
              </p>
              <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
                {items.map((tx, index) => {
                  const typeVariant = TYPE_VARIANTS[tx.type] ?? "secondary";
                  const typeKey = `type${tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}` as Parameters<typeof t>[0];
                  const typeLabel = t.has(typeKey) ? t(typeKey) : tx.type;
                  const isCash = (tx as SerializedTransaction & { isCash?: boolean }).isCash;
                  const symbol = isCash ? null : (tx.holding?.symbol ?? null);
                  const qty = `${tx.quantity > 0 ? "+" : ""}${formatQuantity(tx.quantity, tx.holding?.assetType ?? "")}`;
                  const time = new Date(tx.createdAt).toLocaleTimeString(undefined, {
                    hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <div key={tx.id}>
                      {index > 0 && <div className="h-px bg-border/60 mx-4" />}
                      <SwipeableTxRow
                        tx={tx}
                        typeLabel={typeLabel}
                        typeVariant={typeVariant}
                        symbol={symbol}
                        qty={qty}
                        time={time}
                        onEdit={() => handleEditClick(tx)}
                        onDelete={() => setDeletingTx(tx)}
                        tCommon={tCommon}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {!isEmpty && !isReachingEnd && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              onClick={() => setSize(size + 1)}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? t("loading") : t("loadMore")}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">{t("labelType")}</Label>
              <div className="col-span-3">
                <Select value={editType} onValueChange={(v) => v && setEditType(v)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder={t("labelType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(editingTx as SerializedTransaction & { isCash?: boolean })?.isCash ? (
                      <>
                        <SelectItem value="DEPOSIT">{t("typeDeposit")}</SelectItem>
                        <SelectItem value="WITHDRAWAL">{t("typeWithdrawal")}</SelectItem>
                        <SelectItem value="EDIT">{t("typeEdit")}</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="BUY">{t("typeBuy")}</SelectItem>
                        <SelectItem value="SELL">{t("typeSell")}</SelectItem>
                        <SelectItem value="EDIT">{t("typeEdit")}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">{t("labelQuantity")}</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">{t("labelDate")}</Label>
              <Input
                id="date"
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="note" className="text-right">{t("labelNote")}</Label>
              <Input
                id="note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTx(null)}>{tCommon("cancel")}</Button>
            <Button onClick={handleEditSave} disabled={isSubmitting}>
              {isSubmitting ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingTx} onOpenChange={(open) => !open && setDeletingTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              {(deletingTx as SerializedTransaction & { isCash?: boolean })?.isCash
                ? t("deleteConfirm")
                : t("deleteConfirmSymbol", { symbol: deletingTx?.holding?.symbol ?? "" })}
            </p>
            {!(deletingTx as SerializedTransaction & { isCash?: boolean })?.isCash && (
              <p className="text-sm text-muted-foreground mt-2">{t("deleteWarning")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTx(null)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isSubmitting}>
              {isSubmitting ? tCommon("deleting") : tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
