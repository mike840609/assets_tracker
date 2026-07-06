"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currencies";
import { InlineBalanceEditor } from "./inline-balance-editor";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const HIDDEN = "***";
type OneOffCashType = "DEPOSIT" | "WITHDRAWAL";
type CashTransactionFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export async function submitOneOffCashTransaction({
  accountId,
  type,
  amount,
  occurrenceDate,
  note,
  fetcher = fetch,
  onSuccess,
}: {
  accountId: string;
  type: OneOffCashType;
  amount: string;
  occurrenceDate?: string;
  note?: string | null;
  fetcher?: CashTransactionFetcher;
  onSuccess?: () => void;
}) {
  const parsedAmount = parseAmountInput(amount.replace(/,/g, ""));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid amount");
  }

  const res = await fetcher(`/api/accounts/${accountId}/cash-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      amount: parsedAmount,
      occurrenceDate: occurrenceDate || undefined,
      note: note?.trim() || null,
    }),
  });

  if (!res.ok) {
    let message = "Failed to record cash transaction";
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      message = err.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  onSuccess?.();
}

interface AccountStatCardsProps {
  account: SerializedAccountWithHoldings;
  totalHoldingsValue: number;
  onSaveBalance: (newBalance: number, note?: string, occurrenceDate?: string) => Promise<void>;
  onCashTransactionRecorded?: () => void;
}

export function AccountStatCards({
  account,
  totalHoldingsValue,
  onSaveBalance,
  onCashTransactionRecorded,
}: AccountStatCardsProps) {
  const router = useRouter();
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const isMobile = useIsMobile();
  const isBrokerage = account.category === "BROKERAGE" || account.category === "CRYPTO_WALLET";
  const isBank = account.category === "BANK";
  const isLiability = account.type === "LIABILITY";
  const depositKey = isLiability ? "typeDepositLiability" : "typeDeposit";
  const withdrawalKey = isLiability ? "typeWithdrawalLiability" : "typeWithdrawal";
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashType, setCashType] = useState<OneOffCashType>("DEPOSIT");
  const [cashAmount, setCashAmount] = useState("");
  const [cashDate, setCashDate] = useState(localToday);
  const [cashNote, setCashNote] = useState("");
  const [submittingCash, setSubmittingCash] = useState(false);

  function resetCashForm() {
    setCashType("DEPOSIT");
    setCashAmount("");
    setCashDate(localToday());
    setCashNote("");
  }

  function openCashDialog() {
    resetCashForm();
    setCashDialogOpen(true);
  }

  function handleCashAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next !== null) setCashAmount(next);
  }

  function handleCashAmountBlur() {
    const raw = cashAmount.replace(/,/g, "");
    if (!raw) return;
    const parsed = parseAmountInput(raw);
    if (!isNaN(parsed)) setCashAmount(formatAmountInput(parsed, 2));
  }

  async function handleCashSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmittingCash(true);
    try {
      await submitOneOffCashTransaction({
        accountId: account.id,
        type: cashType,
        amount: cashAmount,
        occurrenceDate: cashDate,
        note: cashNote,
        onSuccess: onCashTransactionRecorded,
      });
      toast.success(t("accountDetail.recordCashSuccess"));
      setCashDialogOpen(false);
      resetCashForm();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accountDetail.recordCashFailed"));
    } finally {
      setSubmittingCash(false);
    }
  }

  const recordCashButton = (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={openCashDialog}>
      <Plus className="h-3.5 w-3.5 mr-1" />
      {t("accountDetail.recordCash")}
    </Button>
  );

  const cashForm = (
    <form className="space-y-4" onSubmit={handleCashSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="one-off-cash-type">{t("recurringCash.labelType")}</Label>
          <Select value={cashType} onValueChange={(v) => v && setCashType(v as OneOffCashType)}>
            <SelectTrigger id="one-off-cash-type" className="w-full min-h-11 md:min-h-8">
              <SelectValue>
                {t(`recurringCash.${cashType === "DEPOSIT" ? depositKey : withdrawalKey}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEPOSIT">{t(`recurringCash.${depositKey}`)}</SelectItem>
              <SelectItem value="WITHDRAWAL">{t(`recurringCash.${withdrawalKey}`)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="one-off-cash-amount">{t("recurringCash.labelAmount")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="one-off-cash-amount"
              type="text"
              inputMode="decimal"
              value={cashAmount}
              onChange={handleCashAmountChange}
              onBlur={handleCashAmountBlur}
              className="min-w-0 flex-1 min-h-11 md:min-h-8"
              required
            />
            <span className="text-xs text-muted-foreground shrink-0">{account.currency}</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="one-off-cash-date">{t("accountDetail.labelOccurredOn")}</Label>
        <Input
          id="one-off-cash-date"
          type="date"
          value={cashDate}
          onChange={(e) => setCashDate(e.target.value)}
          className="min-h-11 md:min-h-8"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="one-off-cash-note">{t("recurringCash.labelNote")}</Label>
        <Input
          id="one-off-cash-note"
          value={cashNote}
          onChange={(e) => setCashNote(e.target.value)}
          className="min-h-11 md:min-h-8"
        />
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 md:min-h-8"
          onClick={() => setCashDialogOpen(false)}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" className="min-h-11 md:min-h-8" disabled={submittingCash}>
          {submittingCash ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );

  const cashDialogTitle = t("accountDetail.recordCashTitle");
  const cashDialog = isMobile ? (
    <Drawer open={cashDialogOpen} onOpenChange={(open) => !open && setCashDialogOpen(false)}>
      <DrawerContent showCloseButton={false}>
        <DrawerHeader>
          <DrawerTitle>{cashDialogTitle}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">{cashForm}</div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={cashDialogOpen} onOpenChange={(open) => !open && setCashDialogOpen(false)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cashDialogTitle}</DialogTitle>
        </DialogHeader>
        {cashForm}
      </DialogContent>
    </Dialog>
  );

  // BANK: cash IS the headline value, edited inline at Display scale.
  if (isBank) {
    return (
      <section className="space-y-1">
        <InlineBalanceEditor
          mode="hero"
          currentBalance={account.cashBalance}
          currency={account.currency}
          notePlaceholder={t("accountDetail.notePlaceholderSalary")}
          onSave={onSaveBalance}
        />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
          {recordCashButton}
        </div>
        {cashDialog}
      </section>
    );
  }

  // BROKERAGE / CRYPTO / OTHER: primary is total value (cash + holdings);
  // secondary breaks it into editable cash balance + holdings market value.
  const totalValue = account.cashBalance + totalHoldingsValue;
  const notePlaceholder =
    account.type === "LIABILITY"
      ? t("accountDetail.notePlaceholderPayment")
      : isBrokerage
        ? t("accountDetail.notePlaceholderDeposit")
        : t("accountDetail.notePlaceholderSalary");
  return (
    <section className="space-y-1">
      <p
        aria-live="polite"
        className="text-4xl font-bold tracking-tight tabular-nums text-foreground"
      >
        {privacyMode ? HIDDEN : formatCurrency(totalValue, account.currency)}
      </p>
      <p className="text-sm text-muted-foreground">{t("accountDetail.totalValue")}</p>
      <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <InlineBalanceEditor
          mode="inline"
          inlineLabel={t("accountDetail.cashBalance")}
          currentBalance={account.cashBalance}
          currency={account.currency}
          notePlaceholder={notePlaceholder}
          onSave={onSaveBalance}
        />
        {recordCashButton}
        <span className="text-muted-foreground">
          {t("accountDetail.holdingsValue")}{" "}
          <span className="tabular-nums font-medium text-foreground">
            {privacyMode ? HIDDEN : formatCurrency(totalHoldingsValue, account.currency)}
          </span>
        </span>
      </div>
      {cashDialog}
    </section>
  );
}
