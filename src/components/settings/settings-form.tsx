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
import {
  useStockColorScheme,
  type StockColorScheme,
} from "@/components/layout/stock-color-scheme-context";
import { Check, TrendingUp, TrendingDown } from "lucide-react";

const COLOR_SCHEMAS: Array<{ id: ColorSchema; light: string; dark: string }> = [
  { id: "emerald", light: "#22c55e", dark: "#4ade80" },
  { id: "anthropic", light: "#d97757", dark: "#e8916e" },
  { id: "ocean", light: "#3b82f6", dark: "#60a5fa" },
  { id: "violet", light: "#8b5cf6", dark: "#a78bfa" },
  { id: "amber", light: "#f59e0b", dark: "#fbbf24" },
  { id: "rose", light: "#f43f5e", dark: "#fb7185" },
];

const STOCK_COLOR_SCHEMES: Array<{
  id: StockColorScheme;
  upColor: string;
  downColor: string;
}> = [
  { id: "GREEN_UP", upColor: "#22c55e", downColor: "#ef4444" },
  { id: "RED_UP", upColor: "#ef4444", downColor: "#22c55e" },
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
  const { stockColorScheme, setStockColorScheme } = useStockColorScheme();
  const [saving, setSaving] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  function pickStockColorScheme(next: StockColorScheme) {
    if (next === stockColorScheme) return;
    setStockColorScheme(next);
    toast.success(t("toast.stockColorSchemeUpdated"));
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      toast.success(t("toast.pricesUpdated", { count: data.updated }));
      router.refresh();
    } catch {
      toast.error(t("toast.pricesFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshExchangeRates() {
    try {
      const res = await fetch("/api/exchange-rates/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("toast.exchangeRatesRefreshed"));
      router.refresh();
    } catch {
      toast.error(t("toast.failed"));
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
              <div className="space-y-1">
                <label htmlFor="currency-select" className="text-sm font-medium">
                  {t("settings.baseCurrency")}
                </label>
              </div>
              <div className="flex items-center gap-2 sm:w-auto w-full">
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger id="currency-select" className="flex-1 sm:flex-none sm:w-[200px]">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <label htmlFor="language-select" className="text-sm font-medium">
                  {t("settings.language")}
                </label>
                <p className="text-sm text-muted-foreground">{t("settings.languageDescription")}</p>
              </div>
              <div className="flex items-center gap-2 sm:w-auto w-full">
                <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                  <SelectTrigger id="language-select" className="flex-1 sm:flex-none sm:w-[200px]">
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
                  onClick={saveLocale}
                  disabled={savingLocale || locale === resolvedActiveLocale}
                >
                  {savingLocale ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
            </div>

            {/* Stock Up/Down Color Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.stockColorScheme")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.stockColorSchemeDescription")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STOCK_COLOR_SCHEMES.map((scheme) => {
                  const isSelected = stockColorScheme === scheme.id;
                  return (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => pickStockColorScheme(scheme.id)}
                      title={t(`settings.stockColorSchemes.${scheme.id}`)}
                      aria-label={t(`settings.stockColorSchemes.${scheme.id}`)}
                      aria-pressed={isSelected}
                      className={`relative w-11 h-11 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-foreground scale-110"
                          : "opacity-70 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${scheme.upColor} 50%, ${scheme.downColor} 50%)`,
                      }}
                    >
                      <TrendingUp
                        aria-hidden
                        className="absolute top-2 left-2 w-3 h-3 text-white drop-shadow"
                      />
                      <TrendingDown
                        aria-hidden
                        className="absolute bottom-2 right-2 w-3 h-3 text-white drop-shadow"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Density Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.density")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.densityDescription")}</p>
              </div>
              <div className="w-fit flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
                {(["comfortable", "compact"] as Density[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDensity(d)}
                    className={`px-3 py-1.5 min-h-[44px] md:min-h-0 flex items-center justify-center rounded-md text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
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
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.colorSchema")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.colorSchemaDescription")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_SCHEMAS.map((schema) => (
                  <button
                    key={schema.id}
                    type="button"
                    onClick={() => setColorSchema(schema.id)}
                    title={t(`settings.colorSchemas.${schema.id}`)}
                    aria-label={t(`settings.colorSchemas.${schema.id}`)}
                    aria-pressed={colorSchema === schema.id}
                    className={`relative w-11 h-11 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      colorSchema === schema.id
                        ? "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${schema.light} 50%, ${schema.dark} 50%)`,
                    }}
                  >
                    {colorSchema === schema.id && (
                      <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />
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
                variant="outline"
                onClick={refreshPrices}
                disabled={refreshing}
                className="w-full sm:w-auto min-w-[150px]"
              >
                {refreshing ? t("settings.refreshing") : t("settings.btnRefresh")}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.syncRatesTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.syncRatesDesc")}</p>
              </div>
              <Button
                variant="outline"
                onClick={refreshExchangeRates}
                className="w-full sm:w-auto min-w-[150px]"
              >
                {t("settings.btnRefresh")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
