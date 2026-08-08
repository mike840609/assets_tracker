"use client";

import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecurringInvestments } from "./recurring-investments";
import { RecurringCashTransactions } from "./recurring-cash-transactions";

/**
 * Single "Recurring" card that groups the two automation subsections —
 * investments (DCA) and cash (deposits/withdrawals) — under one heading.
 * Keeping them in one card (vs two near-identical stacked cards) gives the page
 * a single, calmer block and lets the subsections carry their own light
 * grouping. Investments are hidden for cash-only (bank) accounts.
 */
export function RecurringSection({
  accountId,
  currency,
  isBank,
  accountType,
  isDemo = false,
  refreshTrigger,
  onChange,
}: {
  accountId: string;
  currency: string;
  isBank: boolean;
  accountType: "ASSET" | "LIABILITY";
  isDemo?: boolean;
  refreshTrigger?: number;
  onChange?: () => void;
}) {
  const t = useTranslations("recurring");
  // DCA only makes sense for asset accounts that hold securities — never for a
  // bank (cash-only) account, and never for a liability (you don't buy stocks
  // from a loan/credit-card account).
  const showInvestments = !isBank && accountType === "ASSET";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isDemo ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">{t("demoPausedTitle")}</p>
            <p className="mt-1 text-xs opacity-80">{t("demoPausedDescription")}</p>
          </div>
        ) : null}
        {showInvestments && (
          <>
            <RecurringInvestments
              accountId={accountId}
              currency={currency}
              refreshTrigger={refreshTrigger}
              onChange={onChange}
            />
            <div className="h-px bg-border/50" />
          </>
        )}
        <RecurringCashTransactions
          accountId={accountId}
          currency={currency}
          accountType={accountType}
          refreshTrigger={refreshTrigger}
          onChange={onChange}
        />
      </CardContent>
    </Card>
  );
}
