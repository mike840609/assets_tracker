"use client";

import { useState, startTransition, useId } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { DiscardConfirmDialog } from "@/components/discard-confirm-dialog";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import { HoldingSearch } from "./holding-search";
import type { SearchResult } from "./holding-search";

const OptionBuilder = dynamic(() => import("./option-builder").then((m) => m.OptionBuilder));

const ASSET_TYPE_KEYS = ["STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER"] as const;

const ASSET_TYPE_TO_CATEGORY: Record<string, string> = {
  STOCK: "BROKERAGE",
  ETF: "BROKERAGE",
  MUTUAL_FUND: "BROKERAGE",
  BOND: "BROKERAGE",
  CRYPTO: "CRYPTO_WALLET",
  OTHER: "BROKERAGE",
  OPTION: "BROKERAGE",
};

type Mode = "stock" | "option";

export function QuickAddHolding({
  open,
  onClose,
  accounts,
  defaultCurrency = "USD",
}: {
  open: boolean;
  onClose: () => void;
  accounts: SerializedAccountWithHoldings[];
  defaultCurrency?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const isMobile = useIsMobile();
  // Stable field ids so every <Label> binds to its control (htmlFor/id).
  const fieldId = useId();
  const symbolId = `${fieldId}-symbol`;
  const assetTypeId = `${fieldId}-asset-type`;
  const nameId = `${fieldId}-name`;
  const quantityId = `${fieldId}-quantity`;
  const accountId = `${fieldId}-account`;
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "account">("form");
  const [mode, setMode] = useState<Mode>("stock");

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [assetType, setAssetType] = useState("STOCK");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [manualMode, setManualMode] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [quantityError, setQuantityError] = useState("");

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setQuantityError("");
    if (!raw) {
      setQuantity("");
      return;
    }
    const [intPart, decPart] = raw.split(".");
    const formatted = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setQuantity(decPart !== undefined ? `${formatted}.${decPart}` : formatted);
  }

  function handleQuantityBlur() {
    const val = quantity.replace(/,/g, "");
    if (!val) {
      setQuantityError("");
      return;
    }
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) {
      setQuantityError(t("quickAddHolding.invalidQuantity", { defaultValue: "Invalid quantity" }));
      return;
    }
    setQuantityError("");
    setQuantity(new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(parsed));
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
    setCurrency(defaultCurrency);
    setQuantity("");
    setQuantityError("");
    setManualMode(false);
  }

  function resetForm() {
    clearSelection();
    setStep("form");
    setMode("stock");
    setSelectedAccountId("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // Dirty once the user has picked/typed a ticker, named it, or set a quantity.
  const isDirty = !!symbol || !!quantity || name.trim() !== "";
  const { confirmOpen, setConfirmOpen, requestClose, confirmDiscard } = useDiscardGuard(
    isDirty,
    handleClose,
  );

  function getMatchingAccounts(typeOverride?: string) {
    const type = typeOverride ?? assetType;
    const targetCategory = ASSET_TYPE_TO_CATEGORY[type] || "BROKERAGE";
    return accounts.filter((a) => a.type === "ASSET" && a.category === targetCategory);
  }

  function proceedToAccount(typeOverride?: string) {
    const matching = getMatchingAccounts(typeOverride);
    setSelectedAccountId(matching.length >= 1 ? matching[0].id : "");
    setStep("account");
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      let accountId = selectedAccountId;

      if (!accountId) {
        const targetCategory = ASSET_TYPE_TO_CATEGORY[assetType] || "BROKERAGE";
        const defaultName = t(
          `quickAddHolding.defaultAccountNames.${targetCategory}` as Parameters<typeof t>[0],
          { defaultValue: "Brokerage" },
        );
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: defaultName,
            type: "ASSET",
            category: targetCategory,
            currency: defaultCurrency,
            cashBalance: 0,
          }),
        });
        if (!res.ok) throw new Error(t("quickAddHolding.createAccountFailed"));
        const { data: newAccount } = await res.json();
        accountId = newAccount.id;
      }

      const res = await fetch(`/api/accounts/${accountId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          name,
          quantity: parseFloat(quantity.replace(/,/g, "")),
          assetType,
          currency,
        }),
      });

      if (!res.ok) {
        let message = t("quickAddHolding.addFailed");
        try {
          const err = await res.json();
          message = err.error?.message || message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      toast.success(t("quickAddHolding.addedSymbol", { symbol }));
      handleClose();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("quickAddHolding.addFailed"));
    } finally {
      setLoading(false);
    }
  }

  const tickerSelected = !!symbol;
  const canProceed =
    (tickerSelected || (manualMode && symbol && name)) &&
    !!quantity &&
    parseFloat(quantity.replace(/,/g, "")) > 0;

  const matchingAccounts = getMatchingAccounts();
  const targetCategory = ASSET_TYPE_TO_CATEGORY[assetType] || "BROKERAGE";
  const categoryLabel = t(`categories.${targetCategory}` as Parameters<typeof t>[0], {
    defaultValue: targetCategory,
  });
  const defaultAccountName = t(
    `quickAddHolding.defaultAccountNames.${targetCategory}` as Parameters<typeof t>[0],
    { defaultValue: "Brokerage" },
  );

  const dialogTitle =
    step === "account"
      ? t("quickAddHolding.titleAccount")
      : mode === "option"
        ? t("quickAddHolding.titleOption" as Parameters<typeof t>[0], {
            defaultValue: "Add Option Contract",
          })
        : t("quickAddHolding.titleSearch");

  const body = (
    <>
      {/* ── Form step ── */}
      {step === "form" && (
        <div className="space-y-4">
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
              <TabsTrigger value="stock">Stock / ETF / Crypto</TabsTrigger>
              <TabsTrigger value="option">Option</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "option" ? (
            <OptionBuilder
              loading={loading}
              onConfigure={(payload) => {
                setSymbol(payload.symbol);
                setName(payload.name);
                setAssetType("OPTION");
                setQuantity(String(payload.quantity));
                setCurrency("USD");
                proceedToAccount("OPTION");
              }}
              onCancel={requestClose}
            />
          ) : (
            <>
              {/* ── Ticker section ── */}
              {tickerSelected ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{symbol}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t(`quickAddHolding.assetTypes.${assetType}` as Parameters<typeof t>[0], {
                          defaultValue: assetType,
                        })}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {currency}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{name}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                    {t("quickAddHolding.change")}
                  </Button>
                </div>
              ) : manualMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={symbolId}>{t("quickAddHolding.labelSymbol")}</Label>
                      <Input
                        id={symbolId}
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        placeholder={t("quickAddHolding.placeholderSymbol")}
                        autoFocus={!isMobile}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={assetTypeId}>{t("quickAddHolding.labelAssetType")}</Label>
                      <select
                        id={assetTypeId}
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {ASSET_TYPE_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {t(`quickAddHolding.assetTypes.${key}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={nameId}>{t("quickAddHolding.labelName")}</Label>
                    <Input
                      id={nameId}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("quickAddHolding.placeholderName")}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                      onClick={() => setManualMode(false)}
                    >
                      Search instead
                    </button>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <HoldingSearch
                    onSelect={selectResult}
                    label={t("quickAddHolding.labelSearch")}
                    placeholder={t("quickAddHolding.placeholderSearch")}
                    autoFocus={!isMobile}
                  />
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {t("quickAddHolding.cantFind")}{" "}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2 hover:text-primary/80"
                        onClick={() => setManualMode(true)}
                      >
                        {t("quickAddHolding.enterManually")}
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* ── Quantity ── */}
              <div className="space-y-2">
                <Label htmlFor={quantityId} className="text-base font-medium">
                  {t("quickAddHolding.labelShares")}
                </Label>
                <Input
                  id={quantityId}
                  type="text"
                  inputMode="decimal"
                  value={quantity}
                  onChange={handleQuantityChange}
                  onBlur={handleQuantityBlur}
                  placeholder={t("quickAddHolding.placeholderShares")}
                  autoFocus={tickerSelected && !isMobile}
                  className="text-lg h-12"
                  aria-invalid={!!quantityError}
                  aria-describedby={quantityError ? `${quantityId}-error` : undefined}
                />
                {quantityError && (
                  <p id={`${quantityId}-error`} className="text-xs text-destructive" role="alert">
                    {quantityError}
                  </p>
                )}
              </div>

              {/* ── Actions ── */}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={requestClose}>
                  {t("quickAddHolding.cancel")}
                </Button>
                <Button type="button" disabled={!canProceed} onClick={() => proceedToAccount()}>
                  {t("quickAddHolding.next")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Account step ── */}
      {step === "account" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">{symbol}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {t(`quickAddHolding.assetTypes.${assetType}` as Parameters<typeof t>[0], {
                  defaultValue: assetType,
                })}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {currency}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {assetType === "OPTION"
                ? `${name} · ${quantity} contract${parseFloat(quantity.replace(/,/g, "")) !== 1 ? "s" : ""}`
                : t("quickAddHolding.sharesSummary", { name, quantity })}
            </p>
          </div>

          {matchingAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("quickAddHolding.noAccountFound", {
                category: categoryLabel,
                name: defaultAccountName,
              })}
            </p>
          )}

          {matchingAccounts.length === 1 && (
            <div className="space-y-2">
              <Label>{t("quickAddHolding.labelAccount")}</Label>
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="font-medium">{matchingAccounts[0].name}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`categories.${matchingAccounts[0].category}` as Parameters<typeof t>[0], {
                    defaultValue: matchingAccounts[0].category,
                  })}
                </p>
              </div>
            </div>
          )}

          {matchingAccounts.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor={accountId}>{t("quickAddHolding.selectAccount")}</Label>
              <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
                <SelectTrigger id={accountId} className="w-full">
                  <SelectValue>
                    {matchingAccounts.find((a) => a.id === selectedAccountId)?.name ??
                      t("quickAddHolding.chooseAccount")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {matchingAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="ghost" onClick={() => setStep("form")}>
              {t("quickAddHolding.back")}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={requestClose}>
                {t("quickAddHolding.cancel")}
              </Button>
              <Button type="button" disabled={loading} onClick={handleSubmit}>
                {loading ? t("quickAddHolding.adding") : t("quickAddHolding.addHolding")}
              </Button>
            </div>
          </div>
        </div>
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

  // Mobile: native bottom sheet (swipe-to-dismiss, safe-area aware).
  // Desktop: centered dialog. Same body, same two-step flow.
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(o) => !o && requestClose()}>
          <DrawerContent showCloseButton={false}>
            <DrawerHeader>
              <DrawerTitle>{dialogTitle}</DrawerTitle>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
      {discardGuard}
    </>
  );
}
