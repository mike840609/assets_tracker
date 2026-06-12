"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { refreshMarketData as requestMarketDataRefresh } from "@/lib/refresh-client";
import { useRefreshCooldown } from "@/hooks/use-refresh-cooldown";
import { CURRENCIES, getLocaleDefaultCurrency } from "@/lib/currencies";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { useDensity, type Density } from "@/components/layout/density-context";
import { useColorSchema, type ColorSchema } from "@/components/layout/color-schema-context";
import { Check, ChevronsUpDown, Clock, RefreshCw, Save } from "lucide-react";

const COLOR_SCHEMAS: Array<{ id: ColorSchema; light: string; dark: string }> = [
  { id: "emerald", light: "#22c55e", dark: "#4ade80" },
  { id: "anthropic", light: "#d97757", dark: "#e8916e" },
  { id: "ocean", light: "#3b82f6", dark: "#60a5fa" },
  { id: "violet", light: "#8b5cf6", dark: "#a78bfa" },
  { id: "amber", light: "#f59e0b", dark: "#fbbf24" },
  { id: "rose", light: "#f43f5e", dark: "#fb7185" },
];

type Currency = (typeof CURRENCIES)[number];

function formatCurrencyLabel(currency: Currency) {
  return `${currency.code} — ${currency.name} (${currency.symbol})`;
}

function subscribeToHydrationReady() {
  return () => {};
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

function CurrencyPicker({
  value,
  locale,
  onChange,
}: {
  value: string;
  locale: Locale;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const selectedCurrency = CURRENCIES.find((currency) => currency.code === value) ?? CURRENCIES[0];
  const defaultCode = getLocaleDefaultCurrency(locale);
  const recommended = CURRENCIES.filter(
    (currency) => currency.code === defaultCode || currency.code === value,
  );
  const otherCurrencies = CURRENCIES.filter(
    (currency) => !recommended.some((item) => item.code === currency.code),
  );

  const renderCurrencyItem = (currency: Currency) => (
    <CommandItem
      key={currency.code}
      value={`${currency.code} ${currency.name} ${currency.symbol}`}
      data-checked={currency.code === value ? "true" : undefined}
      onSelect={() => {
        onChange(currency.code);
        setOpen(false);
      }}
    >
      <span className="w-11 shrink-0 font-medium tabular-nums">{currency.code}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{currency.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{currency.symbol}</span>
    </CommandItem>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="h-9 w-full justify-between gap-3 sm:w-[240px]"
      >
        <span className="min-w-0 truncate text-left font-normal">
          {formatCurrencyLabel(selectedCurrency)}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("currencySearchTitle")}
        description={t("currencySearchDescription")}
        className="top-[22%] translate-y-0 sm:max-w-md"
      >
        <CommandInput placeholder={t("currencySearchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("currencySearchEmpty")}</CommandEmpty>
          <CommandGroup heading={t("recommendedCurrency")}>
            {recommended.map(renderCurrencyItem)}
          </CommandGroup>
          <CommandGroup heading={t("allCurrencies")}>
            {otherCurrencies.map(renderCurrencyItem)}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function SettingsForm({
  currentCurrency,
  currentLocale,
  lastPriceUpdate,
  lastExchangeRateUpdate,
}: {
  currentCurrency: string;
  currentLocale: string;
  lastPriceUpdate?: string | null;
  lastExchangeRateUpdate?: string | null;
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
  const { density, isReady: isDensityReady, setDensity } = useDensity();
  const { colorSchema, isReady: isColorSchemaReady, setColorSchema } = useColorSchema();
  const isHydrated = useSyncExternalStore(
    subscribeToHydrationReady,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { coolingDown, secondsLeft } = useRefreshCooldown();
  const [clientPriceRefreshAt, setClientPriceRefreshAt] = useState<string | null>(null);
  const [clientRatesRefreshAt, setClientRatesRefreshAt] = useState<string | null>(null);

  const preferencesChanged = currency !== currentCurrency || locale !== resolvedActiveLocale;
  const effectiveLastPriceUpdate =
    clientPriceRefreshAt && (!lastPriceUpdate || clientPriceRefreshAt > lastPriceUpdate)
      ? clientPriceRefreshAt
      : lastPriceUpdate;
  const effectiveLastRatesUpdate =
    clientRatesRefreshAt &&
    (!lastExchangeRateUpdate || clientRatesRefreshAt > lastExchangeRateUpdate)
      ? clientRatesRefreshAt
      : lastExchangeRateUpdate;

  async function savePreferences() {
    if (!preferencesChanged) return;
    setSaving(true);
    try {
      const payload: { baseCurrency?: string; locale?: Locale } = {};
      if (currency !== currentCurrency) payload.baseCurrency = currency;
      if (locale !== resolvedActiveLocale) payload.locale = locale;

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("toast.preferencesUpdated"));
      if (payload.locale) {
        // Delay so the toast is visible before the full reload
        setTimeout(() => window.location.reload(), 800);
      } else {
        router.refresh();
      }
    } catch {
      toast.error(t("toast.preferencesFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function refreshMarketData() {
    setRefreshing(true);
    try {
      const outcome = await requestMarketDataRefresh();
      switch (outcome.status) {
        case "updated": {
          const refreshedAt = new Date().toISOString();
          setClientPriceRefreshAt(refreshedAt);
          // Don't stamp the rates badge when the FX fetch failed — the badge
          // would claim freshness the DB doesn't have.
          if (!outcome.ratesFetchFailed) setClientRatesRefreshAt(refreshedAt);
          toast.success(
            t("toast.marketDataUpdated", {
              prices: outcome.prices,
              rates: outcome.rates,
            }),
          );
          if (outcome.ratesFetchFailed) toast.warning(t("toast.ratesRefreshFailed"));
          router.refresh();
          break;
        }
        case "fresh":
          if (outcome.ratesFetchFailed) {
            toast.warning(t("toast.ratesRefreshFailed"));
          } else {
            toast.info(t("toast.marketDataFresh"));
          }
          break;
        case "cooldown":
          toast.info(t("toast.refreshCooldown", { seconds: outcome.retryAfterSeconds }));
          break;
        case "error":
          toast.error(t("toast.marketDataFailed"));
          break;
      }
    } finally {
      setRefreshing(false);
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
                <p className="text-sm font-medium">{t("settings.baseCurrency")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.baseCurrencyDescription")}
                </p>
              </div>
              <CurrencyPicker value={currency} locale={locale} onChange={setCurrency} />
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
              </div>
            </div>

            {/* Density Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.density")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.densityDescription")}</p>
              </div>
              <div className="w-fit flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
                {(["comfortable", "compact"] as Density[]).map((d) => {
                  const isActive = isHydrated && isDensityReady && density === d;

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      className={`px-3 py-1.5 min-h-[44px] md:min-h-0 flex items-center justify-center rounded-md text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isActive
                          ? "bg-background border border-border shadow-sm text-foreground font-semibold"
                          : "border border-transparent text-muted-foreground font-medium hover:text-foreground"
                      }`}
                      aria-pressed={isActive}
                    >
                      {d === "comfortable"
                        ? t("settings.densityComfortable")
                        : t("settings.densityCompact")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Schema Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("settings.colorSchema")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.colorSchemaDescription")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_SCHEMAS.map((schema) => {
                  const isActive = isHydrated && isColorSchemaReady && colorSchema === schema.id;

                  return (
                    <button
                      key={schema.id}
                      type="button"
                      onClick={() => setColorSchema(schema.id)}
                      title={t(`settings.colorSchemas.${schema.id}`)}
                      aria-label={t(`settings.colorSchemas.${schema.id}`)}
                      aria-pressed={isActive}
                      className={`relative w-11 h-11 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isActive
                          ? "ring-2 ring-offset-2 ring-foreground scale-110"
                          : "opacity-70 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${schema.light} 50%, ${schema.dark} 50%)`,
                      }}
                    >
                      {isActive && (
                        <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {preferencesChanged
                  ? t("settings.preferencesUnsaved")
                  : t("settings.preferencesSaved")}
              </p>
              <Button
                type="button"
                onClick={savePreferences}
                disabled={saving || !preferencesChanged}
                className="w-full sm:w-auto sm:min-w-[150px]"
              >
                {saving ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 size-4" aria-hidden="true" />
                )}
                {saving ? t("settings.saving") : t("settings.saveChanges")}
              </Button>
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
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("settings.syncMarketDataTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.syncMarketDataDesc")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {effectiveLastPriceUpdate ? (
                    <FreshnessBadge kind="price" timestamp={effectiveLastPriceUpdate} />
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {t("settings.noPriceUpdate")}
                    </span>
                  )}
                  {effectiveLastRatesUpdate ? (
                    <FreshnessBadge kind="rates" timestamp={effectiveLastRatesUpdate} />
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {t("settings.noRateUpdate")}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={refreshMarketData}
                disabled={refreshing || coolingDown}
                title={
                  coolingDown ? t("toast.refreshCooldown", { seconds: secondsLeft }) : undefined
                }
                className="w-full sm:w-auto min-w-[150px]"
              >
                <RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? t("settings.refreshing") : t("settings.btnRefreshMarketData")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
