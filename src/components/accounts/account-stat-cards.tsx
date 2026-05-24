"use client";

import { formatCurrency } from "@/lib/currencies";
import { InlineBalanceEditor } from "./inline-balance-editor";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { SerializedAccountWithHoldings } from "@/lib/types";

const HIDDEN = "***";

interface AccountStatCardsProps {
  account: SerializedAccountWithHoldings;
  totalHoldingsValue: number;
  onSaveBalance: (newBalance: number, note?: string) => Promise<void>;
}

export function AccountStatCards({
  account,
  totalHoldingsValue,
  onSaveBalance,
}: AccountStatCardsProps) {
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const isBrokerage = account.category === "BROKERAGE" || account.category === "CRYPTO_WALLET";
  const isBank = account.category === "BANK";

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
        <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
      </section>
    );
  }

  // BROKERAGE / CRYPTO: primary is market value; cash is the only secondary fact
  // (holdings count lives in the Holdings section title below).
  if (isBrokerage) {
    return (
      <section className="space-y-1">
        <p
          aria-live="polite"
          className="text-4xl font-bold tracking-tight tabular-nums text-foreground"
        >
          {privacyMode ? HIDDEN : formatCurrency(totalHoldingsValue, account.currency)}
        </p>
        <p className="text-sm text-muted-foreground">{t("accountDetail.marketValue")}</p>
        <div className="pt-2">
          <InlineBalanceEditor
            mode="inline"
            inlineLabel={t("accountDetail.cashBalance")}
            currentBalance={account.cashBalance}
            currency={account.currency}
            notePlaceholder={t("accountDetail.notePlaceholderDeposit")}
            onSave={onSaveBalance}
          />
        </div>
      </section>
    );
  }

  // OTHER / INVESTMENT: primary is total value; secondary breaks it into cash + holdings value.
  const totalValue = account.cashBalance + totalHoldingsValue;
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
          notePlaceholder={t("accountDetail.notePlaceholderSalary")}
          onSave={onSaveBalance}
        />
        <span className="text-muted-foreground">
          {t("accountDetail.holdingsValue")}{" "}
          <span className="tabular-nums font-medium text-foreground">
            {privacyMode ? HIDDEN : formatCurrency(totalHoldingsValue, account.currency)}
          </span>
        </span>
      </div>
    </section>
  );
}
