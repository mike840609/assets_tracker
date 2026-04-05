"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useTranslations } from "next-intl";
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
  const [currency, setCurrency] = useState(currentCurrency);
  const [locale, setLocale] = useState<Locale>(
    SUPPORTED_LOCALES.includes(currentLocale as Locale) ? (currentLocale as Locale) : DEFAULT_LOCALE
  );
  const [saving, setSaving] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  async function saveCurrency() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: currency }),
      });
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
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      toast.success(t("toast.languageUpdated"));
      // Full reload so the new locale cookie is read by next-intl
      window.location.reload();
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
      const data = await res.json();
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
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.baseCurrency")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger>
              <SelectValue />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger>
              <SelectValue />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.dataActions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={refreshPrices}
            disabled={refreshing}
          >
            {refreshing ? t("settings.refreshing") : t("settings.refreshPrices")}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() =>
              fetch("/api/exchange-rates/refresh", { method: "POST" })
                .then(() => toast.success(t("toast.exchangeRatesRefreshed")))
                .catch(() => toast.error(t("toast.failed")))
            }
          >
            {t("settings.refreshExchangeRates")}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={takeSnapshot}
            disabled={snapshotting}
          >
            {snapshotting ? t("settings.creating") : t("settings.takeSnapshot")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
