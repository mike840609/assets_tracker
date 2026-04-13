import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { getTranslations } from "next-intl/server";
import type { NetWorthSummary } from "@/lib/types";

export async function NetWorthCard({
  summary,
  previousNetWorth,
}: {
  summary: NetWorthSummary;
  previousNetWorth?: number;
}) {
  const { totalAssets, totalLiabilities, netWorth, baseCurrency } = summary;
  const t = await getTranslations("netWorthCard");

  const delta = previousNetWorth !== undefined ? netWorth - previousNetWorth : null;
  const pct =
    delta !== null && previousNetWorth !== undefined && previousNetWorth !== 0
      ? (delta / Math.abs(previousNetWorth)) * 100
      : null;

  const isPositive = delta !== null && delta >= 0;
  const deltaColor = delta === null ? "" : isPositive ? "text-green-600" : "text-red-600";
  const deltaSign = delta !== null && delta > 0 ? "+" : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{t("netWorth")}</p>
          <p className="text-3xl font-bold tracking-tight mt-1">
            {formatCurrency(netWorth, baseCurrency)}
          </p>
          {delta !== null && pct !== null && (
            <p className={`text-sm font-medium mt-1 ${deltaColor}`}>
              {deltaSign}{formatCurrency(delta, baseCurrency)}{" "}
              ({deltaSign}{pct.toFixed(2)}%)
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{t("totalAssets")}</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">
            {formatCurrency(totalAssets, baseCurrency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{t("totalLiabilities")}</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">
            {formatCurrency(totalLiabilities, baseCurrency)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
