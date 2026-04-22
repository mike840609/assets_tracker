"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";

export function SettingsForm({
  currentCurrency,
  currentLocale,
}: {
  currentCurrency: string;
  currentLocale: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const activeLocale = useLocale();
  const [currency, setCurrency] = useState(currentCurrency);
  const [locale, setLocale] = useState<Locale>(
    SUPPORTED_LOCALES.includes(activeLocale as Locale) ? (activeLocale as Locale) : DEFAULT_LOCALE
  );
  const [saving, setSaving] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  async function saveCurrency() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: currency }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("toast.currencyUpdated"));
      router.refresh();
    } catch {
      toast.error(t("toast.currencyFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveLocale() {
    setSavingLocale(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("toast.languageUpdated"));
      // Delay so the toast is visible before the full reload
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error(t("toast.languageFailed"));
    } finally {
      setSavingLocale(false);
    }
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      const { data } = await res.json();
      toast.success(t("toast.pricesUpdated", { count: data.updated }));
      router.refresh();
    } catch {
      toast.error(t("toast.pricesFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  async function takeSnapshot() {
    setSnapshotting(true);
    try {
      await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: currency }),
      });
      toast.success(t("toast.snapshotCreated"));
      router.refresh();
    } catch {
      toast.error(t("toast.snapshotFailed"));
    } finally {
      setSnapshotting(false);
    }
  }

  return (
    <div className="space-y-8 w-full">
      {/* PREFERENCES SECTION */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">
          {t("settings.preferencesTitle")}
        </h3>
        <Card className="overflow-hidden p-0">
          <CardContent className="p-0">
            {/* Currency Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.baseCurrency")}</p>
              </div>
              <div className="flex items-center gap-2 sm:w-auto w-full">
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>
                      {(() => {
                        const c = CURRENCIES.find((c) => c.code === currency);
                        return c ? `${c.code} — ${c.name} (${c.symbol})` : currency;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={saveCurrency} disabled={saving || currency === currentCurrency}>
                  {saving ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
            </div>

            {/* Language Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.language")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.languageDescription")}</p>
              </div>
              <div className="flex items-center gap-2 sm:w-auto w-full">
                <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>{t(`languages.${locale}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LOCALES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`languages.${l}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={saveLocale} disabled={savingLocale || locale === currentLocale}>
                  {savingLocale ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SYNCHRONIZATION SECTION */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">
          {t("settings.synchronizationTitle")}
        </h3>
        <Card className="overflow-hidden p-0">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.syncPricesTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.syncPricesDesc")}</p>
              </div>
              <Button
                variant="outline"
                onClick={refreshPrices}
                disabled={refreshing}
                className="w-full sm:w-auto min-w-[150px]"
              >
                {refreshing ? t("settings.refreshing") : t("settings.btnRefresh")}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.syncRatesTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.syncRatesDesc")}</p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  fetch("/api/exchange-rates/refresh", { method: "POST" })
                    .then(() => toast.success(t("toast.exchangeRatesRefreshed")))
                    .catch(() => toast.error(t("toast.failed")))
                }
                className="w-full sm:w-auto min-w-[150px]"
              >
                {t("settings.btnRefresh")}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.syncSnapshotTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.syncSnapshotDesc")}</p>
              </div>
              <Button
                variant="outline"
                onClick={takeSnapshot}
                disabled={snapshotting}
                className="w-full sm:w-auto min-w-[150px]"
              >
                {snapshotting ? t("settings.creating") : t("settings.btnSnapshot")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
