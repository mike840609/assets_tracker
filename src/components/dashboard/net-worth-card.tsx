"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { useTranslations } from "next-intl";
import type { NetWorthSummary } from "@/lib/types";

export function NetWorthCard({ summary }: { summary: NetWorthSummary }) {
  const { totalAssets, totalLiabilities, netWorth, baseCurrency } = summary;
  const t = useTranslations("netWorthCard");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{t("netWorth")}</p>
          <p className="text-3xl font-bold tracking-tight mt-1">
            {formatCurrency(netWorth, baseCurrency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{t("totalAssets")}</p>
          <div className="flex items-center gap-2 mt-1">
            <TrendingUp className="h-5 w-5 text-green-600 shrink-0" aria-hidden="true" />
            <p className="text-2xl font-semibold text-green-600">
              {formatCurrency(totalAssets, baseCurrency)}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{t("totalLiabilities")}</p>
          <div className="flex items-center gap-2 mt-1">
            <TrendingDown className="h-5 w-5 text-red-600 shrink-0" aria-hidden="true" />
            <p className="text-2xl font-semibold text-red-600">
              {formatCurrency(totalLiabilities, baseCurrency)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
