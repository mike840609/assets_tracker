"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { SerializedHolding } from "@/lib/types";

const ASSET_TYPES = [
  { value: "STOCK", label: "Stock" },
  { value: "ETF", label: "ETF" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "BOND", label: "Bond" },
  { value: "OTHER", label: "Other" },
];

export function EditHoldingDialog({
  open,
  onClose,
  holding,
  accountId,
}: {
  open: boolean;
  onClose: () => void;
  holding: SerializedHolding;
  accountId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [name, setName] = useState(holding.name);
  const [assetType, setAssetType] = useState<"STOCK" | "ETF" | "CRYPTO" | "MUTUAL_FUND" | "BOND" | "OTHER">(holding.assetType);

  function handleOpen(isOpen: boolean) {
    if (!isOpen) {
      onClose();
    }
  }

  // Reset form when holding changes
  function resetToHolding() {
    setQuantity(String(holding.quantity));
    setName(holding.name);
    setAssetType(holding.assetType);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error("Quantity must be a positive number");
      setLoading(false);
      return;
    }

    // Build update payload — only send changed fields
    const updates: Record<string, unknown> = { id: holding.id };
    if (parsedQty !== holding.quantity) updates.quantity = parsedQty;
    if (name !== holding.name) updates.name = name;
    if (assetType !== holding.assetType) updates.assetType = assetType;

    // Nothing changed
    if (Object.keys(updates).length === 1) {
      onClose();
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${accountId}/holdings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.error) || "Failed");
      }

      toast.success("Holding updated");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update holding"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol display (read-only) */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{holding.symbol}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {holding.currency || "USD"}
                </Badge>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetToHolding}
              className="text-xs text-muted-foreground"
            >
              Reset
            </Button>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apple Inc."
              required
            />
          </div>

          {/* Asset Type */}
          <div className="space-y-2">
            <Label>Asset Type</Label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as typeof assetType)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Quantity</Label>
            <Input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 100"
              required
              className="text-lg h-12"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
