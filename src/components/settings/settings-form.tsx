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
import { useDensity, type Density } from "@/components/layout/density-context";
import { useColorSchema, type ColorSchema } from "@/components/layout/color-schema-context";
import { Check, Loader2 } from "lucide-react";

const COLOR_SCHEMAS: Array<{ id: ColorSchema; light: string; dark: string }> = [
  { id: "emerald", light: "oklch(0.6 0.16 150)", dark: "oklch(0.8 0.17 170)" },
  { id: "anthropic", light: "oklch(0.62 0.13 45)", dark: "oklch(0.72 0.13 45)" },
  { id: "ocean", light: "oklch(0.62 0.16 250)", dark: "oklch(0.74 0.14 240)" },
  { id: "violet", light: "oklch(0.58 0.18 295)", dark: "oklch(0.72 0.16 295)" },
  { id: "amber", light: "oklch(0.72 0.15 85)", dark: "oklch(0.82 0.13 85)" },
  { id: "rose", light: "oklch(0.62 0.18 15)", dark: "oklch(0.72 0.16 15)" },
];

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
  const resolvedActiveLocale: Locale = SUPPORTED_LOCALES.includes(activeLocale as Locale)
    ? (activeLocale as Locale)
    : SUPPORTED_LOCALES.includes(currentLocale as Locale)
      ? (currentLocale as Locale)
      : DEFAULT_LOCALE;
  const [currency, setCurrency] = useState(currentCurrency);
  const [locale, setLocale] = useState<Locale>(resolvedActiveLocale);
  const { density, setDensity } = useDensity();
  const { colorSchema, setColorSchema } = useColorSchema();
  const [saving, setSaving] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingRates, setRefreshingRates] = useState(false);

  async function saveCurrency() {
    if (saving || currency === currentCurrency) return;
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
    if (savingLocale || locale === resolvedActiveLocale) return;
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
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      toast.success(t("toast.pricesUpdated", { count: data?.updated ?? 0 }));
      router.refresh();
    } catch {
      toast.error(t("toast.pricesFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshRates() {
    if (refreshingRates) return;
    setRefreshingRates(true);
    try {
      const res = await fetch("/api/exchange-rates/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("toast.exchangeRatesRefreshed"));
      router.refresh();
    } catch {
      toast.error(t("toast.exchangeRatesFailed"));
    } finally {
      setRefreshingRates(false);
    }
  }

  return (
    <div className="space-y-8 w-full">
      {/* PREFERENCES SECTION */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{t("settings.preferencesTitle")}</h3>
        <Card className="overflow-hidden p-0">
          <CardContent className="p-0">
            {/* Currency Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1 min-w-0">
                <p id="settings-base-currency-label" className="text-sm font-medium">
                  {t("settings.baseCurrency")}
                </p>
              </div>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:w-auto">
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger
                    aria-labelledby="settings-base-currency-label"
                    className="w-full min-h-11 sm:w-[200px] md:min-h-8"
                  >
                    <SelectValue>
                      {(() => {
                        const c = CURRENCIES.find((c) => c.code === currency);
                        return c ? `${c.code} - ${c.name} (${c.symbol})` : currency;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={saveCurrency}
                  disabled={saving || currency === currentCurrency}
                  aria-label={t("settings.saveBaseCurrency")}
                  className="min-h-11 md:min-h-8"
                >
                  {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {saving ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
            </div>

            {/* Language Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1 min-w-0">
                <p id="settings-language-label" className="text-sm font-medium">
                  {t("settings.language")}
                </p>
                <p className="text-sm text-muted-foreground">{t("settings.languageDescription")}</p>
              </div>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:w-auto">
                <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                  <SelectTrigger
                    aria-labelledby="settings-language-label"
                    className="w-full min-h-11 sm:w-[200px] md:min-h-8"
                  >
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
                <Button
                  type="button"
                  onClick={saveLocale}
                  disabled={savingLocale || locale === resolvedActiveLocale}
                  aria-label={t("settings.saveLanguage")}
                  className="min-h-11 md:min-h-8"
                >
                  {savingLocale && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {savingLocale ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
            </div>

            {/* Density Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1 min-w-0">
                <p id="settings-density-label" className="text-sm font-medium">
                  {t("settings.density")}
                </p>
                <p className="text-sm text-muted-foreground">{t("settings.densityDescription")}</p>
              </div>
              <div
                className="w-full sm:w-fit flex items-center gap-1 rounded-lg border p-1 bg-muted/30"
                aria-labelledby="settings-density-label"
                role="group"
              >
                {(["comfortable", "compact"] as Density[]).map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`min-h-11 flex-1 rounded-md px-3 py-1.5 text-sm transition-all md:min-h-8 ${
                      density === d
                        ? "bg-background border border-border shadow-sm text-foreground font-semibold"
                        : "border border-transparent text-muted-foreground font-medium hover:text-foreground"
                    }`}
                    aria-pressed={density === d}
                  >
                    {d === "comfortable"
                      ? t("settings.densityComfortable")
                      : t("settings.densityCompact")}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Schema Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1 min-w-0">
                <p id="settings-color-schema-label" className="text-sm font-medium">
                  {t("settings.colorSchema")}
                </p>
                <p className="hidden text-sm text-muted-foreground sm:block">
                  {t("settings.colorSchemaDescription")}
                </p>
              </div>
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-labelledby="settings-color-schema-label"
              >
                {COLOR_SCHEMAS.map((schema) => (
                  <button
                    type="button"
                    key={schema.id}
                    onClick={() => setColorSchema(schema.id)}
                    title={t(`settings.colorSchemas.${schema.id}`)}
                    aria-label={t("settings.colorSchemaOption", {
                      schema: t(`settings.colorSchemas.${schema.id}`),
                    })}
                    aria-pressed={colorSchema === schema.id}
                    className={`relative size-11 rounded-full transition-all md:size-8 ${
                      colorSchema === schema.id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${schema.light} 50%, ${schema.dark} 50%)`,
                    }}
                  >
                    {colorSchema === schema.id && (
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-primary-foreground drop-shadow md:h-3.5 md:w-3.5" />
                    )}
                  </button>
                ))}
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
                type="button"
                variant="outline"
                onClick={refreshPrices}
                disabled={refreshing}
                aria-label={t("settings.refreshPricesLabel")}
                className="min-h-11 w-full sm:w-auto sm:min-w-[150px] md:min-h-8"
              >
                {refreshing && <Loader2 className="animate-spin" aria-hidden="true" />}
                {refreshing ? t("settings.refreshing") : t("settings.btnRefresh")}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.syncRatesTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.syncRatesDesc")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={refreshRates}
                disabled={refreshingRates}
                aria-label={t("settings.refreshRatesLabel")}
                className="min-h-11 w-full sm:w-auto sm:min-w-[150px] md:min-h-8"
              >
                {refreshingRates && <Loader2 className="animate-spin" aria-hidden="true" />}
                {refreshingRates ? t("settings.refreshing") : t("settings.btnRefresh")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
