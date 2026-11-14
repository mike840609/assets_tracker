"use client";

import { useId, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { assertOk, errorText } from "@/lib/api-error";
import type { SerializedHolding } from "@/lib/types";

import { getOptionDisplay } from "@/lib/options";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";

const ASSET_TYPES = ["STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER"] as const;

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
  const t = useTranslations("editHolding");
  const tForm = useTranslations("quickAddHolding");
  const tOption = useTranslations("optionBuilder");
  const tCommon = useTranslations("common");
  // Links each <Label> to its control so the visible text is the accessible name.
  const fieldId = useId();
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(() =>
    formatAmountInput(Number(holding.quantity), holding.assetType === "OPTION" ? 0 : 6),
  );
  const [name, setName] = useState(holding.name);
  const [assetType, setAssetType] = useState<
    "STOCK" | "ETF" | "CRYPTO" | "MUTUAL_FUND" | "BOND" | "OTHER" | "OPTION"
  >(holding.assetType);
  const isOption = holding.assetType === "OPTION";
  const optionDisplay = getOptionDisplay(holding);

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next !== null) setQuantity(next);
  }

  function handleQuantityBlur() {
    const val = quantity.replace(/,/g, "");
    if (!val) return;
    const parsed = isOption ? parseInt(val, 10) : parseAmountInput(val);
    if (isNaN(parsed)) return;
    setQuantity(isOption ? formatAmountInput(parsed, 0) : formatAmountInput(parsed, 6));
  }

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

    const parsedQty = parseAmountInput(quantity);
    const minAllowed = isOption ? 0 : Number.MIN_VALUE;
    if (isNaN(parsedQty) || parsedQty < minAllowed) {
      toast.error(isOption ? t("quantityNonNegative") : t("quantityPositive"));
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

      await assertOk(res, tCommon("sessionExpired"));

      toast.success(t("updated"));
      onClose();
      if (onSuccess) onSuccess();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(errorText(error, t("updateFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
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
              {t("reset")}
            </Button>
          </div>

          {!isOption && (
            <>
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-name`}>{tForm("labelName")}</Label>
                <Input
                  id={`${fieldId}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tForm("placeholderName")}
                  required
                />
              </div>

              {/* Asset Type */}
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-asset-type`}>{tForm("labelAssetType")}</Label>
                <select
                  id={`${fieldId}-asset-type`}
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as typeof assetType)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {ASSET_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {tForm(`assetTypes.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-quantity`} className="text-base font-medium">
              {isOption ? tOption("numContracts") : tForm("labelShares")}
            </Label>
            <Input
              id={`${fieldId}-quantity`}
              type="text"
              inputMode={isOption ? "numeric" : "decimal"}
              value={quantity}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              placeholder={isOption ? tOption("placeholderContracts") : tForm("placeholderShares")}
              required
              className="text-lg h-12"
            />
            {isOption && <p className="text-xs text-muted-foreground">{t("closeHint")}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon("saving") : t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
