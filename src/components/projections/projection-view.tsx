"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatNumber, getCurrencySymbol } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { ProjectionChart, type ChartPoint } from "./projection-chart";

const GUIDE_STORAGE_KEY = "asset-tracker:projections-guide-open";

interface ProjectionResult {
  fireNumber: number;
  yearsToFire: number | null;
  fireYear: number | null;
  progressPct: number;
  projectedPoints: { year: number; netWorth: number }[];
}

function computeProjection(
  currentNetWorth: number,
  annualExpenses: number,
  annualSavings: number,
  expectedReturnFraction: number,
  withdrawalRateFraction: number,
  startYear: number,
  maxYears = 60,
): ProjectionResult {
  if (annualExpenses <= 0 || withdrawalRateFraction <= 0) {
    return {
      fireNumber: 0,
      yearsToFire: null,
      fireYear: null,
      progressPct: 0,
      projectedPoints: [],
    };
  }

  const fireNumber = annualExpenses / withdrawalRateFraction;
  const progressPct = fireNumber > 0 ? Math.min((currentNetWorth / fireNumber) * 100, 100) : 0;

  if (currentNetWorth >= fireNumber) {
    return {
      fireNumber,
      yearsToFire: 0,
      fireYear: startYear,
      progressPct: 100,
      projectedPoints: [{ year: startYear, netWorth: currentNetWorth }],
    };
  }

  const projectedPoints: { year: number; netWorth: number }[] = [];
  let nw = currentNetWorth;
  let yearsToFire: number | null = null;
  let fireYear: number | null = null;

  for (let t = 0; t <= maxYears; t++) {
    projectedPoints.push({ year: startYear + t, netWorth: Math.max(0, nw) });
    if (nw >= fireNumber && yearsToFire === null) {
      yearsToFire = t;
      fireYear = startYear + t;
    }
    // Annual compounding then add savings
    nw = nw * (1 + expectedReturnFraction) + annualSavings;
  }

  return { fireNumber, yearsToFire, fireYear, progressPct, projectedPoints };
}

function KpiTile({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "neutral";
}) {
  const valueClass = tone === "positive" ? "text-[var(--chart-1)]" : "text-foreground";
  return (
    <Card size="sm" className="min-w-0 py-2 sm:py-3">
      <CardContent className="space-y-0.5 px-2 sm:space-y-1.5 sm:px-3">
        <div className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground sm:line-clamp-1 sm:text-xs sm:leading-normal">
          {title}
        </div>
        <div
          className={`text-sm font-semibold tracking-tight tabular-nums sm:text-2xl ${valueClass}`}
        >
          {value}
        </div>
        {subtitle && (
          <div className="hidden text-xs text-muted-foreground sm:block">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
  suffix,
  prefix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(() =>
    value === 0
      ? ""
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value),
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    if (!raw) {
      setDisplay("");
      onChange(0);
      return;
    }
    const [intPart, decPart] = raw.split(".");
    const formattedInt = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setDisplay(decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed));
    }
  }

  function handleBlur() {
    const raw = display.replace(/,/g, "");
    const parsed = parseFloat(raw);
    if (!raw || isNaN(parsed)) {
      setDisplay("");
      return;
    }
    const clamped = Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    setDisplay(new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(clamped));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground select-none">
            {prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          value={display}
          placeholder="0"
          onChange={handleChange}
          onBlur={handleBlur}
          className={`h-9 text-sm ${suffix ? "pr-10" : ""}`}
          style={
            prefix ? { paddingLeft: `calc(0.75rem + ${prefix.length}ch + 0.5rem)` } : undefined
          }
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground select-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  latestNetWorth: number;
  trailing12mSavings: number;
  annualSnapshots: { year: number; netWorth: number }[];
  hasData: boolean;
  baseCurrency: string;
}

export function ProjectionView({
  latestNetWorth,
  trailing12mSavings,
  annualSnapshots,
  hasData,
  baseCurrency,
}: Props) {
  const t = useTranslations("projections");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

  const currentYear = new Date().getFullYear();
  const lastHistoricalYear = annualSnapshots.at(-1)?.year ?? currentYear;

  // Assumption state — users can override these
  const [annualExpenses, setAnnualExpenses] = useState(0);
  const [annualSavings, setAnnualSavings] = useState(Math.max(0, Math.round(trailing12mSavings)));
  const [expectedReturn, setExpectedReturn] = useState(7); // percent
  const [withdrawalRate, setWithdrawalRate] = useState(4); // percent
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(
    () =>
      startTransition(() => setGuideOpen(window.localStorage.getItem(GUIDE_STORAGE_KEY) === "1")),
    [],
  );

  const toggleGuide = () => {
    const next = !guideOpen;
    setGuideOpen(next);
    window.localStorage.setItem(GUIDE_STORAGE_KEY, next ? "1" : "0");
  };

  const projection = useMemo(
    () =>
      computeProjection(
        latestNetWorth,
        annualExpenses,
        annualSavings,
        expectedReturn / 100,
        withdrawalRate / 100,
        lastHistoricalYear,
      ),
    [
      latestNetWorth,
      annualExpenses,
      annualSavings,
      expectedReturn,
      withdrawalRate,
      lastHistoricalYear,
    ],
  );

  const chartData = useMemo((): ChartPoint[] => {
    if (!hasData) return [];

    const lastYear = annualSnapshots.at(-1)?.year ?? new Date().getFullYear();
    const historicalYearSet = new Set(annualSnapshots.map((s) => s.year));
    const points: ChartPoint[] = annualSnapshots.map((s) => ({
      year: s.year,
      historical: s.netWorth,
      // Overlap last historical point with projected series so lines connect
      projected: s.year === lastYear ? s.netWorth : undefined,
    }));

    for (const p of projection.projectedPoints) {
      if (historicalYearSet.has(p.year)) continue;
      points.push({ year: p.year, projected: p.netWorth });
      if (projection.fireYear && p.year >= projection.fireYear + 3) break;
    }

    return points.sort((a, b) => a.year - b.year);
  }, [annualSnapshots, projection, hasData]);

  // --- KPI values ---
  const fireNumberDisplay = privacyMode
    ? "***"
    : annualExpenses > 0
      ? formatCurrency(projection.fireNumber, baseCurrency, true)
      : "—";

  const currentNWDisplay = privacyMode ? "***" : formatCurrency(latestNetWorth, baseCurrency, true);

  const progressDisplay = annualExpenses > 0 ? `${formatNumber(projection.progressPct, 1)}%` : "—";

  const fireYearDisplay = (() => {
    if (annualExpenses <= 0) return "—";
    if (projection.yearsToFire === 0) return t("alreadyFired");
    if (projection.fireYear === null) return t("neverLabel");
    const yrs = projection.yearsToFire ?? 0;
    return `${projection.fireYear} · ${t("yearsAway", { years: yrs })}`;
  })();

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center text-sm text-muted-foreground">
        {t("noData")}
      </div>
    );
  }

  return (
    <div className={isCompact ? "space-y-3" : "space-y-6"}>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <KpiTile title={t("fireNumber")} value={fireNumberDisplay} />
        <KpiTile title={t("currentNetWorth")} value={currentNWDisplay} />
        <KpiTile
          title={t("progressToFire")}
          value={progressDisplay}
          subtitle={annualExpenses > 0 ? undefined : t("enterExpenses")}
          tone={projection.progressPct >= 100 ? "positive" : "neutral"}
        />
        <KpiTile
          title={t("projectedFireDate")}
          value={fireYearDisplay}
          tone={projection.yearsToFire === 0 ? "positive" : "neutral"}
        />
      </div>

      {/* Chart */}
      <div className="premium-card">
        <ProjectionChart
          data={chartData}
          fireNumber={projection.fireNumber}
          fireYear={projection.fireYear}
          baseCurrency={baseCurrency}
        />
      </div>

      {/* Assumptions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{t("assumptions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberInput
              label={t("annualExpenses")}
              value={annualExpenses}
              onChange={setAnnualExpenses}
              min={0}
              prefix={getCurrencySymbol(baseCurrency)}
            />
            <NumberInput
              label={t("annualSavings")}
              hint={trailing12mSavings > 0 ? t("annualSavingsHint") : undefined}
              value={annualSavings}
              onChange={setAnnualSavings}
              min={0}
              prefix={getCurrencySymbol(baseCurrency)}
            />
            <NumberInput
              label={t("expectedReturn")}
              value={expectedReturn}
              onChange={setExpectedReturn}
              min={0}
              max={30}
              suffix="%"
            />
            <NumberInput
              label={t("withdrawalRate")}
              hint={t("withdrawalRateHint")}
              value={withdrawalRate}
              onChange={setWithdrawalRate}
              min={0.5}
              max={10}
              suffix="%"
            />
          </div>
        </CardContent>
      </Card>

      {/* Collapsible guide card */}
      <Card className="bg-muted/30 border-border/50">
        <button
          type="button"
          onClick={toggleGuide}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
          aria-expanded={guideOpen}
        >
          <span className="text-base font-semibold">{t("howItWorks")}</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${guideOpen ? "rotate-180" : ""}`}
          />
        </button>

        {guideOpen && (
          <CardContent className="space-y-6 pt-0">
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { num: "1", title: t("step1Title"), desc: t("step1Desc") },
                { num: "2", title: t("step2Title"), desc: t("step2Desc") },
                { num: "3", title: t("step3Title"), desc: t("step3Desc") },
              ].map((step) => (
                <div key={step.num} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {step.num}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-primary/8 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">{t("fireRuleTitle")}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t("fireRuleBody")}</p>
              <p className="inline-block rounded bg-background/60 px-3 py-2 font-mono text-sm font-medium text-foreground">
                {t("fireRuleExample")}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("fireRuleFootnote")}
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
