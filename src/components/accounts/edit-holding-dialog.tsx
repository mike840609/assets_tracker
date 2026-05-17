"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { SerializedHolding } from "@/lib/types";

import { getOptionDisplay } from "@/lib/options";
import {
  formatNumberInputValue,
  useFormattedNumberInput,
} from "@/hooks/use-formatted-number-input";

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
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  holding: SerializedHolding;
  accountId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isOption = holding.assetType === "OPTION";
  const {
    value: quantity,
    rawValue: quantityRawValue,
    setValue: setQuantity,
    handleChange: handleQuantityChange,
    handleBlur: handleQuantityBlur,
  } = useFormattedNumberInput({
    initialValue: () =>
      formatNumberInputValue(Number(holding.quantity), {
        maximumFractionDigits: isOption ? 0 : 6,
        integer: isOption,
      }),
    maximumFractionDigits: isOption ? 0 : 6,
    integer: isOption,
  });
  const [name, setName] = useState(holding.name);
  const [assetType, setAssetType] = useState<
    "STOCK" | "ETF" | "CRYPTO" | "MUTUAL_FUND" | "BOND" | "OTHER" | "OPTION"
  >(holding.assetType);
  const optionDisplay = getOptionDisplay(holding);

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

    const parsedQty = parseFloat(quantityRawValue);
    const minAllowed = isOption ? 0 : Number.MIN_VALUE;
    if (isNaN(parsedQty) || parsedQty < minAllowed) {
      toast.error(
        isOption ? "Quantity must be 0 or greater" : "Quantity must be a positive number",
      );
      setLoading(false);
      return;
    }
    if (!isOption && parsedQty <= 0) {
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
        throw new Error(err.error?.message || "Failed");
      }

      toast.success("Holding updated");
      onClose();
      if (onSuccess) onSuccess();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update holding");
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
                <span className="font-mono font-bold">
                  {optionDisplay ? optionDisplay.short : holding.symbol}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {holding.currency || "USD"}
                </Badge>
              </div>
              {optionDisplay && (
                <p className="text-xs text-muted-foreground mt-0.5">{optionDisplay.long}</p>
              )}
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

          {!isOption && (
            <>
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
            </>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
              {isOption ? "Number of contracts" : "Quantity"}
            </Label>
            <Input
              type="text"
              inputMode={isOption ? "numeric" : "decimal"}
              value={quantity}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              placeholder={isOption ? "e.g. 1" : "e.g. 100"}
              required
              className="text-lg h-12"
            />
            {isOption && (
              <p className="text-xs text-muted-foreground">Set to 0 to close the position.</p>
            )}
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
