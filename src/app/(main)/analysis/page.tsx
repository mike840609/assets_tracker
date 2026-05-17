import { Suspense } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import {
  getFullNormalizedHistory,
  getRawHistoryWithBreakdown,
  getMonthlyCashFlow,
  getAccountMonthlyCashFlow,
} from "@/lib/services/history-service";
import {
  fetchUserAllocationTargets,
  computeAllocationDrift,
} from "@/lib/services/allocation-service";
import { getCachedNetWorthSummary } from "@/lib/services/net-worth-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AnalysisView } from "@/components/analysis/analysis-view";
import AnalysisLoading from "./loading";
import type { AllocationDriftItem } from "@/lib/types";
import { ACCOUNT_CATEGORIES } from "@/lib/enums";

const CLIENT_NAMESPACES = ["analysis", "categories", "nav", "trendChart", "history", "allocation"];

const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCK: "Stock",
  ETF: "ETF",
  CRYPTO: "Crypto",
  MUTUAL_FUND: "Mutual Fund",
  BOND: "Bond",
  OTHER: "Other",
};

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  ACCOUNT_CATEGORIES.map((c) => [c, c.replace(/_/g, " ")]),
);

async function AnalysisContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settings = await getOrCreateSettings(userId);
  const baseCurrency = settings.baseCurrency;

  const [
    t,
    messages,
    snapshots,
    cashFlowData,
    rawHistory,
    accountCashFlow,
    locale,
    targets,
    summary,
  ] = await Promise.all([
    getTranslations("analysis"),
    getMessages(),
    getFullNormalizedHistory(userId, baseCurrency),
    getMonthlyCashFlow(userId, baseCurrency),
    getRawHistoryWithBreakdown(userId, baseCurrency),
    getAccountMonthlyCashFlow(userId, baseCurrency),
    getLocale(),
    fetchUserAllocationTargets(userId),
    getCachedNetWorthSummary(userId, baseCurrency),
  ]);

  const allocationDrift: AllocationDriftItem[] = computeAllocationDrift(
    targets,
    summary,
    (scope, key) =>
      scope === "ASSET_TYPE" ? (ASSET_TYPE_LABELS[key] ?? key) : (CATEGORY_LABELS[key] ?? key),
  );

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <AnalysisView
          snapshots={snapshots}
          cashFlowData={cashFlowData}
          rawHistory={rawHistory}
          accountCashFlow={accountCashFlow}
          baseCurrency={baseCurrency}
          locale={locale}
          allocationDrift={allocationDrift}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisLoading />}>
      <AnalysisContent />
    </Suspense>
  );
}
