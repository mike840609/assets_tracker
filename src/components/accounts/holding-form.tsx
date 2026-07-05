"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { DiscardConfirmDialog } from "@/components/discard-confirm-dialog";
import { toast } from "sonner";
import { HoldingSearch } from "./holding-search";
import type { SearchResult } from "./holding-search";
import { OptionBuilder } from "./option-builder";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";

const ASSET_TYPES = ["STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER"] as const;

type Mode = "stock" | "option";

export function HoldingForm({
  open,
  onClose,
  accountId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("quickAddHolding");
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("stock");

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [assetType, setAssetType] = useState("STOCK");
  const [currency, setCurrency] = useState("USD");
  const [manualMode, setManualMode] = useState(false);
  const [quantityError, setQuantityError] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitPriceError, setUnitPriceError] = useState("");

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next === null) return;
    setQuantityError("");
    setQuantity(next);
  }

  function handleQuantityBlur() {
    const val = quantity.replace(/,/g, "");
    if (!val) {
      setQuantityError("");
      return;
    }
    const parsed = parseAmountInput(val);
    if (isNaN(parsed) || parsed <= 0) {
      setQuantityError(t("invalidQuantity"));
      return;
    }
    setQuantityError("");
    setQuantity(formatAmountInput(parsed, 6));
  }

  function handleUnitPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next === null) return;
    setUnitPriceError("");
    setUnitPrice(next);
  }

  function handleUnitPriceBlur() {
    const val = unitPrice.replace(/,/g, "");
    if (!val) {
      setUnitPriceError("");
      return;
    }
    const parsed = parseAmountInput(val);
    if (isNaN(parsed) || parsed <= 0) {
      setUnitPriceError(t("invalidUnitPrice"));
      return;
    }
    setUnitPriceError("");
    setUnitPrice(formatAmountInput(parsed, 6));
  }

  function selectResult(result: SearchResult) {
    setSymbol(result.symbol);
    setName(result.name);
    setAssetType(result.type);
    setCurrency(result.currency);
    setManualMode(false);
  }

  function clearSelection() {
    setSymbol("");
    setName("");
    setAssetType("STOCK");
    setCurrency("USD");
    setQuantity("");
    setQuantityError("");
    setUnitPrice("");
    setUnitPriceError("");
    setManualMode(false);
  }

  function resetForm() {
    clearSelection();
    setMode("stock");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function postHolding(payload: {
    symbol: string;
    name: string;
    quantity: number;
    assetType: string;
    currency: string;
    unitPrice?: number;
  }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || t("addFailed"));
      }

      toast.success(t("addedSymbol", { symbol: payload.symbol }));
      handleClose();
      if (onSuccess) onSuccess();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("addFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedUnitPrice = unitPrice ? parseAmountInput(unitPrice) : undefined;
    await postHolding({
      symbol,
      name,
      quantity: parseAmountInput(quantity),
      assetType,
      currency,
      ...(parsedUnitPrice !== undefined && { unitPrice: parsedUnitPrice }),
    });
  }

  const tickerSelected = !!symbol;
  const parsedUnitPrice = unitPrice ? parseAmountInput(unitPrice) : undefined;
  const canSubmit =
    (tickerSelected || (manualMode && symbol && name)) &&
    !!quantity &&
    parseAmountInput(quantity) > 0 &&
    !unitPriceError &&
    (parsedUnitPrice === undefined || parsedUnitPrice > 0);

  // Dirty once the user has picked/typed a ticker, named it, or set a quantity.
  const isDirty = !!symbol || !!quantity || name.trim() !== "";
  const { confirmOpen, setConfirmOpen, requestClose, confirmDiscard } = useDiscardGuard(
    isDirty,
    handleClose,
  );

  const title = mode === "option" ? t("titleOption") : t("titleConfirm");

  const body = (
    <>
      {/* Mode tabs */}
      <Tabs
        value={mode}
        onValueChange={(v) => {
          if (v) {
            setMode(v as Mode);
            clearSelection();
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="stock">{t("tabStock")}</TabsTrigger>
          <TabsTrigger value="option">{t("tabOption")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "option" ? (
        <OptionBuilder loading={loading} onSubmit={postHolding} onCancel={requestClose} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Ticker section ── */}
          {tickerSelected ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{symbol}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {t(`assetTypes.${assetType}` as Parameters<typeof t>[0])}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {currency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{name}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                {t("change")}
              </Button>
            </div>
          ) : manualMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("labelSymbol")}</Label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder={t("placeholderSymbol")}
                    autoFocus={!isMobile}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("labelAssetType")}</Label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {ASSET_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {t(`assetTypes.${value}` as Parameters<typeof t>[0])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("labelName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("placeholderName")}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <button
                  type="button"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => setManualMode(false)}
                >
                  {t("searchInstead")}
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <HoldingSearch
                onSelect={selectResult}
                autoFocus={!isMobile}
                label={t("labelSearch")}
                placeholder={t("placeholderSearch")}
              />
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {t("cantFind")}{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                    onClick={() => setManualMode(true)}
                  >
                    {t("enterManually")}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ── Quantity ── */}
          <div className="space-y-2">
            <Label className="text-base font-medium">{t("labelShares")}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              placeholder={t("placeholderShares")}
              required
              autoFocus={tickerSelected && !isMobile}
              className="text-lg h-12"
            />
            {quantityError && <p className="text-xs text-destructive">{quantityError}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">{t("labelUnitPrice")}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={unitPrice}
              onChange={handleUnitPriceChange}
              onBlur={handleUnitPriceBlur}
              placeholder={t("placeholderUnitPrice")}
              className="text-lg h-12"
            />
            {unitPriceError && <p className="text-xs text-destructive">{unitPriceError}</p>}
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? t("adding") : t("addHolding")}
            </Button>
          </div>
        </form>
      )}
    </>
  );

  const discardGuard = (
    <DiscardConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      onDiscard={confirmDiscard}
    />
  );

  // Mobile: native bottom sheet. Desktop: centered dialog. Same form body.
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(o) => !o && requestClose()}>
          <DrawerContent showCloseButton={false}>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">{body}</div>
          </DrawerContent>
        </Drawer>
        {discardGuard}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && requestClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
      {discardGuard}
    </>
  );
}
