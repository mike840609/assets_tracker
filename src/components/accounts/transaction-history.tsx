"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  BUY: { label: "Buy", variant: "default" },
  SELL: { label: "Sell", variant: "destructive" },
  DEPOSIT: { label: "Deposit", variant: "default" },
  WITHDRAWAL: { label: "Withdrawal", variant: "destructive" },
  EDIT: { label: "Edit", variant: "secondary" },
};

export function TransactionHistory({ accountId, isBank, refreshTrigger }: { accountId: string; isBank?: boolean; refreshTrigger?: number }) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<SerializedTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editingTx, setEditingTx] = useState<SerializedTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<SerializedTransaction | null>(null);

  // Form state
  const [editType, setEditType] = useState("BUY");
  const [editQuantity, setEditQuantity] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTransactions = useCallback(() => {
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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

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

      toast.success("Transaction updated");
      setEditingTx(null);
      fetchTransactions();
      router.refresh(); // Refresh holdings on parent page
    } catch (e) {
      toast.error("Failed to update transaction");
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

      toast.success("Transaction deleted");
      setDeletingTx(null);
      fetchTransactions();
      router.refresh(); // Refresh holdings on parent page
    } catch (e) {
      toast.error("Failed to delete transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No transactions yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>{isBank ? "" : "Symbol"}</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">{isBank ? "Amount" : "Quantity"}</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-[50px]"></TableHead>
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
                      {(t as any).isCash ? "" : (t.holding?.symbol ?? "—")}
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 px-0 hover:bg-accent hover:text-accent-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(t)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletingTx(t)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
      </CardContent>

      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
              <div className="col-span-3">
                <Select value={editType} onValueChange={(v) => v && setEditType(v)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(editingTx as any)?.isCash ? (
                      <>
                        <SelectItem value="DEPOSIT">Deposit</SelectItem>
                        <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                        <SelectItem value="EDIT">Edit</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="BUY">Buy</SelectItem>
                        <SelectItem value="SELL">Sell</SelectItem>
                        <SelectItem value="EDIT">Edit</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">Quantity</Label>
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
              <Label htmlFor="date" className="text-right">Date</Label>
              <Input
                id="date"
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="note" className="text-right">Note</Label>
              <Input
                id="note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTx(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingTx} onOpenChange={(open) => !open && setDeletingTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this transaction{(deletingTx as any)?.isCash ? "?" : ` for ${deletingTx?.holding?.symbol}?`}</p>
            {!(deletingTx as any)?.isCash && (
              <p className="text-sm text-muted-foreground mt-2">This will also affect your total holding quantity for this asset.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTx(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
