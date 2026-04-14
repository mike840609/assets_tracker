import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { InlineBalanceEditor } from "./inline-balance-editor";
import { useTranslations } from "next-intl";
import type { SerializedAccountWithHoldings } from "@/lib/types";

interface AccountStatCardsProps {
  account: SerializedAccountWithHoldings;
  totalHoldingsValue: number;
  onSaveBalance: (newBalance: number, note?: string) => Promise<void>;
}

export function AccountStatCards({ account, totalHoldingsValue, onSaveBalance }: AccountStatCardsProps) {
  const t = useTranslations();
  const isBrokerage = account.category === "BROKERAGE" || account.category === "CRYPTO_WALLET";
  const isBank = account.category === "BANK";
  const totalValue = account.cashBalance + totalHoldingsValue;

  if (isBrokerage) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("accountDetail.marketValue")}</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalHoldingsValue, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("accountDetail.holdingsCount")}</p>
            <p className="text-2xl font-bold mt-1">{account.holdings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
            <InlineBalanceEditor
              currentBalance={account.cashBalance}
              currency={account.currency}
              notePlaceholder={t("accountDetail.notePlaceholderDeposit")}
              onSave={onSaveBalance}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isBank) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
            <InlineBalanceEditor
              currentBalance={account.cashBalance}
              currency={account.currency}
              notePlaceholder={t("accountDetail.notePlaceholderSalary")}
              onSave={onSaveBalance}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Investment / other
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("accountDetail.totalValue")}</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(totalValue, account.currency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("accountDetail.cashBalance")}</p>
          <InlineBalanceEditor
            currentBalance={account.cashBalance}
            currency={account.currency}
            notePlaceholder={t("accountDetail.notePlaceholderSalary")}
            onSave={onSaveBalance}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("accountDetail.holdingsValue")}</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(totalHoldingsValue, account.currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
