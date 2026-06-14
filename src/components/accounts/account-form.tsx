"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";
import { ACCOUNT_CATEGORIES } from "@/lib/enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { DiscardConfirmDialog } from "@/components/discard-confirm-dialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function AccountForm({
  open,
  onClose,
  defaultCurrency = "USD",
}: {
  open: boolean;
  onClose: () => void;
  defaultCurrency?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const isMobile = useIsMobile();
  // Stable field ids so every <Label> binds to its control (htmlFor/id).
  const fieldId = useId();
  const nameId = `${fieldId}-name`;
  const typeId = `${fieldId}-type`;
  const categoryId = `${fieldId}-category`;
  const currencyId = `${fieldId}-currency`;
  const cashId = `${fieldId}-cash`;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"ASSET" | "LIABILITY">("ASSET");
  const [category, setCategory] = useState("BANK");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [cashBalance, setCashBalance] = useState("0");
  const [cashBalanceError, setCashBalanceError] = useState("");

  // Reset to defaults, then close, so a discarded/submitted form doesn't reopen
  // with stale input.
  function handleClose() {
    setName("");
    setType("ASSET");
    setCategory("BANK");
    setCurrency(defaultCurrency);
    setCashBalance("0");
    setCashBalanceError("");
    onClose();
  }

  // Dirty if the user typed a name or changed the balance off its default.
  const isDirty = name.trim() !== "" || cashBalance.replace(/,/g, "") !== "0";
  const { confirmOpen, setConfirmOpen, requestClose, confirmDiscard } = useDiscardGuard(
    isDirty,
    handleClose,
  );

  function handleCashBalanceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next === null) return;
    setCashBalanceError("");
    setCashBalance(next);
  }

  function handleCashBalanceBlur() {
    const val = cashBalance.replace(/,/g, "");
    if (!val) {
      setCashBalance("0");
      setCashBalanceError("");
      return;
    }
    const parsed = parseAmountInput(val);
    if (isNaN(parsed)) {
      setCashBalanceError(t("accountForm.invalidAmount", { defaultValue: "Invalid amount" }));
      return;
    }
    setCashBalanceError("");
    setCashBalance(formatAmountInput(parsed, 2));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          category,
          currency,
          cashBalance: parseAmountInput(cashBalance) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.issues?.fieldErrors?.name?.[0] || t("accountForm.createFailed"));
      }

      toast.success(t("accountForm.created"));
      handleClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accountForm.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>{t("accountForm.labelName")}</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("accountForm.placeholderName")}
          required
          // Desktop only: on a mobile bottom sheet, auto-focus yanks the soft
          // keyboard up over the sheet mid-animation. Let it settle first.
          autoFocus={!isMobile}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={typeId}>{t("accountForm.labelType")}</Label>
          <Select value={type} onValueChange={(v) => v && setType(v as "ASSET" | "LIABILITY")}>
            <SelectTrigger id={typeId}>
              <SelectValue>
                {type === "ASSET" ? t("accountForm.optionAsset") : t("accountForm.optionLiability")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ASSET">{t("accountForm.optionAsset")}</SelectItem>
              <SelectItem value="LIABILITY">{t("accountForm.optionLiability")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={categoryId}>{t("accountForm.labelCategory")}</Label>
          <Select value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger id={categoryId}>
              <SelectValue>{t(`categories.${category}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_CATEGORIES.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`categories.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={currencyId}>{t("accountForm.labelCurrency")}</Label>
        <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
          <SelectTrigger id={currencyId}>
            <SelectValue>{currency}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Brokerage/crypto value comes from holdings, so only cash accounts edit a balance here. */}
      {category !== "BROKERAGE" && category !== "CRYPTO_WALLET" && (
        <div className="space-y-2">
          <Label htmlFor={cashId}>{t("accountForm.labelCashBalance")}</Label>
          <Input
            id={cashId}
            type="text"
            inputMode="decimal"
            value={cashBalance}
            onChange={handleCashBalanceChange}
            onBlur={handleCashBalanceBlur}
            aria-invalid={!!cashBalanceError}
            aria-describedby={cashBalanceError ? `${cashId}-error` : undefined}
          />
          {cashBalanceError && (
            <p id={`${cashId}-error`} className="text-xs text-destructive" role="alert">
              {cashBalanceError}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={requestClose}>
          {t("accountForm.cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? t("accountForm.creating") : t("accountForm.create")}
        </Button>
      </div>
    </form>
  );

  const discardGuard = (
    <DiscardConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      onDiscard={confirmDiscard}
    />
  );

  // Mobile: native bottom sheet, matching the add-holding flow so both "Add"
  // actions share one affordance. Desktop: centered dialog.
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(o) => !o && requestClose()}>
          <DrawerContent showCloseButton={false}>
            <DrawerHeader>
              <DrawerTitle>{t("accountForm.title")}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">{formBody}</div>
          </DrawerContent>
        </Drawer>
        {discardGuard}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && requestClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("accountForm.title")}</DialogTitle>
          </DialogHeader>
          {formBody}
        </DialogContent>
      </Dialog>
      {discardGuard}
    </>
  );
}
