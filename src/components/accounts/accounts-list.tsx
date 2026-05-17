"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import { DesktopAccountsTable } from "./desktop-accounts-table";
import { MobileAccountSections } from "./mobile-account-sections";
import { useAccountListModel } from "./use-account-list-model";

const AccountForm = dynamic(() => import("./account-form").then((m) => m.AccountForm));

const QuickAddHolding = dynamic(() => import("./quick-add-holding").then((m) => m.QuickAddHolding));

export function AccountsList({
  accounts,
  priceMap,
  ratesMap = {},
  baseCurrency = "USD",
}: {
  accounts: SerializedAccountWithHoldings[];
  priceMap: Record<string, number>;
  ratesMap?: Record<string, number>;
  baseCurrency?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const model = useAccountListModel({ accounts, priceMap, ratesMap, baseCurrency });

  useEffect(() => {
    const handler = () => setShowForm(true);
    window.addEventListener("new-item", handler);
    return () => window.removeEventListener("new-item", handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowQuickAdd(true);
    window.addEventListener("add-item", handler);
    return () => window.removeEventListener("add-item", handler);
  }, []);

  async function deleteAccount(id: string) {
    if (!confirm(t("accountsList.deleteConfirm"))) return;

    setDeletingId(id);
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("accountsList.deleteSuccess"));
      router.refresh();
    } catch {
      toast.error(t("accountsList.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowQuickAdd(true)}>
          {t("accountsList.addItem")}
        </Button>
        <Button onClick={() => setShowForm(true)}>{t("accountsList.addAccount")}</Button>
      </div>

      {accounts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("accountsList.noAccounts")}</p>
      )}

      {accounts.length > 0 && (
        <DesktopAccountsTable
          assets={model.assets}
          liabilities={model.liabilities}
          sortedAccounts={model.sortedAccounts}
          accountBaseValues={model.accountBaseValues}
          totalAssets={model.totalAssets}
          totalLiabilities={model.totalLiabilities}
          baseCurrency={baseCurrency}
          priceMap={priceMap}
          ratesMap={ratesMap}
          sortKey={model.sortKey}
          sortDir={model.sortDir}
          onToggleSort={model.toggleSort}
          onNavigate={(accountId) => router.push(`/accounts/${accountId}`)}
          onDelete={deleteAccount}
          deletingId={deletingId}
        />
      )}

      <MobileAccountSections
        assetsByCategory={model.assetsByCategory}
        liabilitiesByCategory={model.liabilitiesByCategory}
        expandedCategories={model.expandedCategories}
        totalAssets={model.totalAssets}
        totalLiabilities={model.totalLiabilities}
        baseCurrency={baseCurrency}
        priceMap={priceMap}
        ratesMap={ratesMap}
        deletingId={deletingId}
        onToggleCategory={model.toggleCategory}
        onDelete={deleteAccount}
      />

      {showForm && (
        <AccountForm
          open={showForm}
          onClose={() => setShowForm(false)}
          defaultCurrency={baseCurrency}
        />
      )}
      {showQuickAdd && (
        <QuickAddHolding
          open={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          accounts={accounts}
          defaultCurrency={baseCurrency}
        />
      )}
    </div>
  );
}
