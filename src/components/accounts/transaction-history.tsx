"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import { useTranslations } from "next-intl";
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
    ? data.flat().map((t: any) => ({
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
      router.refresh(); // Refresh holdings on parent page
    } catch (e) {
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
      router.refresh(); // Refresh holdings on parent page
    } catch (e) {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {t("empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colDate")}</TableHead>
                <TableHead>{isBank ? "" : t("colSymbol")}</TableHead>
                <TableHead>{t("colType")}</TableHead>
                <TableHead className="text-right">{isBank ? t("colAmount") : t("colQuantity")}</TableHead>
                <TableHead>{t("colNote")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                const typeVariant = TYPE_VARIANTS[tx.type] ?? "secondary";
                const typeKey = `type${tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}` as Parameters<typeof t>[0];
                const typeLabel = t.has(typeKey) ? t(typeKey) : tx.type;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {(tx as any).isCash ? "" : (tx.holding?.symbol ?? "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeVariant}>{typeLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {tx.quantity > 0 ? "+" : ""}
                      {formatQuantity(tx.quantity, tx.holding?.assetType ?? "")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.note || "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 px-0 hover:bg-accent hover:text-accent-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(tx)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tCommon("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletingTx(tx)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!isEmpty && !isReachingEnd && (
          <div className="flex justify-center mt-6">
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
                    {(editingTx as any)?.isCash ? (
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
              {(deletingTx as any)?.isCash
                ? t("deleteConfirm")
                : t("deleteConfirmSymbol", { symbol: deletingTx?.holding?.symbol ?? "" })}
            </p>
            {!(deletingTx as any)?.isCash && (
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
