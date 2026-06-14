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
  refreshTrigger,
  onChange,
}: {
  accountId: string;
  currency: string;
  isBank: boolean;
  refreshTrigger?: number;
  onChange?: () => void;
}) {
  const t = useTranslations("recurring");

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
        {!isBank && (
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
          refreshTrigger={refreshTrigger}
          onChange={onChange}
        />
      </CardContent>
    </Card>
  );
}
