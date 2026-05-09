"use client";

import { useRef, useState, useEffect, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
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
import { registerSwipeRow, closeOtherSwipeRows } from "@/lib/swipe-row-registry";
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
import { showUndoDeleteToast } from "@/lib/undo-delete";

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  BUY: "default",
  SELL: "destructive",
  DEPOSIT: "default",
  WITHDRAWAL: "destructive",
  EDIT: "secondary",
};

const ACTION_WIDTH = 60;
const REVEAL_WIDTH = 144; // fixed: accommodates gap-2 + px-2 while keeping both action buttons equal width
const SNAP_THRESHOLD = REVEAL_WIDTH * 0.4;
const FULL_SWIPE = REVEAL_WIDTH + 80; // past this → trigger delete on release

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

function SwipeableTxRow({
  tx,
  typeLabel,
  typeVariant,
  symbol,
  qty,
  time,
  onEdit,
  onDelete,
  tCommon,
}: TxRowProps) {
  const x = useMotionValue(0);
  const hasFiredHaptic = useRef(false);
  const hasFiredDangerHaptic = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    function close() {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      setIsOpen(false);
      hasFiredHaptic.current = false;
      hasFiredDangerHaptic.current = false;
    }
    closeRef.current = close;
    return registerSwipeRow(close);
  }, [x]);

  const actionsOpacity = useTransform(x, [-REVEAL_WIDTH * 0.5, 0], [1, 0], { clamp: true });
  const iconScale = useTransform(x, [0, -REVEAL_WIDTH], [0.65, 1.0], { clamp: true });
  const editOpacity = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [1, 0], { clamp: true });
  const editWidth = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [ACTION_WIDTH, 0], {
    clamp: true,
  });
  const deleteIconScale = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [1.0, 1.3], {
    clamp: true,
  });
  const dangerOpacity = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [0, 1], { clamp: true });

  function snapOpen() {
    closeOtherSwipeRows(closeRef.current);
    animate(x, -REVEAL_WIDTH, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(true);
  }

  function snapClose() {
    animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(false);
    hasFiredHaptic.current = false;
    hasFiredDangerHaptic.current = false;
  }

  function handleDrag() {
    const cur = x.get();
    if (!hasFiredHaptic.current && cur < -SNAP_THRESHOLD) {
      hapticTick();
      hasFiredHaptic.current = true;
    } else if (hasFiredHaptic.current && cur > -SNAP_THRESHOLD) {
      hasFiredHaptic.current = false;
    }
    if (!hasFiredDangerHaptic.current && cur < -FULL_SWIPE) {
      hapticTick();
      hapticTick();
      hasFiredDangerHaptic.current = true;
    } else if (hasFiredDangerHaptic.current && cur > -FULL_SWIPE) {
      hasFiredDangerHaptic.current = false;
    }
  }

  function handleDragEnd() {
    const cur = x.get();
    if (cur < -FULL_SWIPE) {
      snapClose();
      hapticTick();
      onDelete(); // opens the confirm dialog
    } else if (cur < -SNAP_THRESHOLD) {
      snapOpen();
      hapticTick();
    } else {
      snapClose();
    }
  }

  return (
    <div className="relative overflow-hidden bg-card select-none">
      {/* Action buttons revealed on left swipe */}
      <motion.div
        className="absolute inset-y-0 right-0 flex gap-2 px-2"
        style={{ opacity: actionsOpacity, width: REVEAL_WIDTH }}
        aria-hidden="true"
      >
        <motion.button
          className="flex items-center justify-center bg-blue-500 text-white text-xs font-medium overflow-hidden rounded-2xl my-1.5 active:brightness-90 transition-[filter]"
          style={{ opacity: editOpacity, width: editWidth, minWidth: 0 }}
          onClick={() => {
            snapClose();
            onEdit();
          }}
          aria-label={tCommon("edit")}
        >
          <motion.div className="flex flex-col items-center gap-1" style={{ scale: iconScale }}>
            <Pencil className="h-4 w-4" />
            <span>{tCommon("edit")}</span>
          </motion.div>
        </motion.button>
        <button
          className="flex-1 flex items-center justify-center bg-destructive text-white text-xs font-medium rounded-2xl my-1.5 active:brightness-90 transition-[filter]"
          onClick={() => {
            snapClose();
            onDelete();
          }}
          aria-label={tCommon("delete")}
        >
          <motion.div
            className="flex flex-col items-center gap-1"
            style={{ scale: deleteIconScale }}
          >
            <Trash2 className="h-4 w-4" />
            <span>{tCommon("delete")}</span>
          </motion.div>
        </button>
      </motion.div>

      {/* Draggable row content */}
      <motion.div
        className="flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors relative z-10"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -(FULL_SWIPE + 60), right: 0 }}
        dragElastic={{ left: 0.12, right: 0.15 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (isOpen) snapClose();
        }}
      >
        {/* Danger-zone red tint bleeds in from the right edge */}
        <motion.div
          className="absolute inset-y-0 right-0 w-28 pointer-events-none"
          style={{
            opacity: dangerOpacity,
            background: "linear-gradient(to left, oklch(0.55 0.22 27 / 0.35), transparent)",
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {symbol && <span className="font-mono font-semibold text-sm">{symbol}</span>}
            <Badge variant={typeVariant} className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
              {typeLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {time}
            {tx.note ? ` · ${tx.note}` : ""}
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

export function TransactionHistory({
  accountId,
  isBank: _isBank,
  refreshTrigger,
}: {
  accountId: string;
  isBank?: boolean;
  refreshTrigger?: number;
}) {
  const router = useRouter();
  const t = useTranslations("transactionHistory");
  const tCommon = useTranslations("common");

  // Dialog state
  const [editingTx, setEditingTx] = useState<SerializedTransaction | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingTxDeletes = useRef<Set<string>>(new Set());

  // Commit any in-flight transaction deletes if the user refreshes/navigates before the toast expires.
  useEffect(() => {
    function flush() {
      for (const id of pendingTxDeletes.current) {
        fetch(`/api/accounts/${accountId}/transactions/${id}`, {
          method: "DELETE",
          keepalive: true,
        });
      }
    }
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [accountId]);

  // Form state
  const [editType, setEditType] = useState("BUY");
  const [editQuantity, setEditQuantity] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [transactions, setTransactions] = useState<SerializedTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadMore = useCallback(
    async (cursor?: string) => {
      const isInitial = cursor === undefined;
      if (isInitial) setIsLoadingInitialData(true);
      else setIsLoadingMore(true);
      try {
        const url = cursor
          ? `/api/accounts/${accountId}/transactions?cursor=${cursor}&limit=20`
          : `/api/accounts/${accountId}/transactions?limit=20`;
        const res = await fetch(url);
        const json = (await res.json()) as {
          data: {
            transactions: (SerializedTransaction & { quantity: string | number })[];
            nextCursor?: string;
            hasMore: boolean;
          };
        };
        const page = json.data;
        const normalized = page.transactions.map((t) => ({
          ...t,
          quantity: Number(t.quantity),
        })) as SerializedTransaction[];
        if (isInitial) {
          setTransactions(normalized);
        } else {
          setTransactions((prev) => [...prev, ...normalized]);
        }
        setNextCursor(page.nextCursor ?? null);
        setHasMore(page.hasMore);
      } finally {
        if (isInitial) setIsLoadingInitialData(false);
        else setIsLoadingMore(false);
      }
    },
    [accountId],
  );

  // Initial load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMore();
  }, [loadMore]);

  // Re-load from start when refreshTrigger changes (after mutations)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (refreshTrigger) void loadMore();
  }, [refreshTrigger, loadMore]);

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
      void loadMore();
      startTransition(() => {
        router.refresh();
      }); // Refresh holdings on parent page
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTx = (tx: SerializedTransaction) => {
    const isCash = (tx as SerializedTransaction & { isCash?: boolean }).isCash;
    const symbol = isCash ? null : (tx.holding?.symbol ?? null);
    const message = symbol ? t("deleteSuccessSymbol", { symbol }) : t("deleteSuccess");

    setPendingDeleteIds((prev) => new Set(prev).add(tx.id));
    pendingTxDeletes.current.add(tx.id);
    showUndoDeleteToast({
      message,
      undoLabel: tCommon("undo"),
      onUndo: () => {
        pendingTxDeletes.current.delete(tx.id);
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(tx.id);
          return next;
        });
      },
      onCommit: async () => {
        pendingTxDeletes.current.delete(tx.id);
        try {
          const res = await fetch(`/api/accounts/${accountId}/transactions/${tx.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed to delete transaction");
          void loadMore();
          startTransition(() => {
            router.refresh();
          });
        } catch {
          toast.error(t("deleteFailed"));
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(tx.id);
            return next;
          });
        }
      },
    });
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

  const dateGroups = transactions.reduce<{ dateKey: string; items: SerializedTransaction[] }[]>(
    (acc, tx) => {
      const dateKey = new Date(tx.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const last = acc[acc.length - 1];
      if (last && last.dateKey === dateKey) {
        last.items.push(tx);
      } else {
        acc.push({ dateKey, items: [tx] });
      }
      return acc;
    },
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t("empty")}</p>
        ) : (
          dateGroups.map(({ dateKey, items }) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1">
                {dateKey}
              </p>
              <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
                {items.map((tx, index) => {
                  const typeVariant = TYPE_VARIANTS[tx.type] ?? "secondary";
                  const typeKey =
                    `type${tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}` as Parameters<
                      typeof t
                    >[0];
                  const typeLabel = t.has(typeKey) ? t(typeKey) : tx.type;
                  const isCash = (tx as SerializedTransaction & { isCash?: boolean }).isCash;
                  const symbol = isCash ? null : (tx.holding?.symbol ?? null);
                  const qty = `${tx.quantity > 0 ? "+" : ""}${formatQuantity(tx.quantity, tx.holding?.assetType ?? "")}`;
                  const time = new Date(tx.createdAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  if (pendingDeleteIds.has(tx.id)) return null;
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
                        onDelete={() => handleDeleteTx(tx)}
                        tCommon={tCommon}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              onClick={() => nextCursor && void loadMore(nextCursor)}
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
              <Label htmlFor="type" className="text-right">
                {t("labelType")}
              </Label>
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
              <Label htmlFor="quantity" className="text-right">
                {t("labelQuantity")}
              </Label>
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
              <Label htmlFor="date" className="text-right">
                {t("labelDate")}
              </Label>
              <Input
                id="date"
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="note" className="text-right">
                {t("labelNote")}
              </Label>
              <Input
                id="note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTx(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEditSave} disabled={isSubmitting}>
              {isSubmitting ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
