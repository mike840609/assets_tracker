"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Flag, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatCurrency, formatNumber, getCurrencySymbol } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useCountUp } from "@/hooks/use-count-up";
import type { ProjectionData } from "@/lib/services/projection-service";
import type { ChartPoint } from "./projection-chart";
import { LazyProjectionChart } from "./lazy-projection-chart";
import { ProjectionOnboarding } from "./projection-onboarding";

const GUIDE_STORAGE_KEY = "asset-tracker:projections-guide-open";
const MAX_YEARS = 60;
const DEFAULT_HORIZON = 30;

type Lens = "nominal" | "real";

interface ProjectionPoint {
  year: number;
  nominal: number;
  real: number;
}

interface ProjectionResult {
  fireNumber: number;
  fireYear: number | null;
  yearsToFire: number | null;
  progressPct: number;
  points: ProjectionPoint[];
}

function computeProjection(
  currentNetWorth: number,
  annualExpenses: number,
  annualSavings: number,
  returnFraction: number,
  withdrawalFraction: number,
  inflationFraction: number,
  startYear: number,
): ProjectionResult {
  const fireNumber =
    annualExpenses > 0 && withdrawalFraction > 0 ? annualExpenses / withdrawalFraction : 0;

  const points: ProjectionPoint[] = [];
  let nw = currentNetWorth;
  let fireYear: number | null = null;
  let yearsToFire: number | null = null;

  for (let t = 0; t <= MAX_YEARS; t++) {
    const real = nw / Math.pow(1 + inflationFraction, t);
    points.push({ year: startYear + t, nominal: Math.max(0, nw), real: Math.max(0, real) });
    if (fireNumber > 0 && nw >= fireNumber && fireYear === null) {
      fireYear = startYear + t;
      yearsToFire = t;
    }
    nw = nw * (1 + returnFraction) + annualSavings;
  }

  const progressPct = fireNumber > 0 ? Math.min((currentNetWorth / fireNumber) * 100, 100) : 0;

  return { fireNumber, fireYear, yearsToFire, progressPct, points };
}

interface MilestoneSpec {
  key: string;
  value: number;
  year: number | null;
  yearsAway: number | null;
  reached: boolean;
}

function buildMilestones(
  points: ProjectionPoint[],
  currentNetWorth: number,
  fireNumber: number,
): MilestoneSpec[] {
  if (points.length === 0) return [];
  const startYear = points[0].year;

  const specs: { key: string; value: number }[] =
    fireNumber > 0
      ? [
          { key: "ms25", value: fireNumber * 0.25 },
          { key: "ms50", value: fireNumber * 0.5 },
          { key: "ms75", value: fireNumber * 0.75 },
          { key: "ms100", value: fireNumber },
        ]
      : currentNetWorth > 0
        ? [
            { key: "msDouble", value: currentNetWorth * 2 },
            { key: "msTriple", value: currentNetWorth * 3 },
            { key: "msQuintuple", value: currentNetWorth * 5 },
          ]
        : [];

  return specs.map((spec) => {
    const hit = points.find((p) => p.nominal >= spec.value);
    const year = hit?.year ?? null;
    const yearsAway = year != null ? year - startYear : null;
    return { ...spec, year, yearsAway, reached: yearsAway === 0 };
  });
}

function SliderField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatNumber(value, step < 1 ? 1 : 0)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
  prefix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(() =>
    value === 0 ? "" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value),
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
          className="h-9 text-sm"
          style={
            prefix ? { paddingLeft: `calc(0.75rem + ${prefix.length}ch + 0.5rem)` } : undefined
          }
        />
      </div>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MilestoneTimeline({
  milestones,
  t,
}: {
  milestones: MilestoneSpec[];
  t: ReturnType<typeof useTranslations<"projections">>;
}) {
  const n = milestones.length;
  const inset = 100 / (2 * n);
  const lastReached = milestones.reduce((acc, m, i) => (m.reached ? i : acc), -1);
  const fillRight = lastReached >= 0 ? inset + (lastReached / (n - 1)) * (100 - 2 * inset) : inset;

  function detail(m: MilestoneSpec) {
    if (m.reached) return t("milestoneReached");
    if (m.year != null) return `${m.year} · ${t("yearsAway", { years: m.yearsAway ?? 0 })}`;
    return t("milestoneBeyond", { years: MAX_YEARS });
  }

  return (
    <div className="relative pt-1">
      {/* Base track + reached fill, behind the nodes */}
      <div
        className="absolute top-4 h-px bg-border"
        style={{ left: `${inset}%`, right: `${inset}%` }}
        aria-hidden
      />
      {lastReached >= 0 && (
        <div
          className="absolute top-4 h-px bg-primary"
          style={{ left: `${inset}%`, right: `${100 - fillRight}%` }}
          aria-hidden
        />
      )}
      <ol className="relative flex">
        {milestones.map((m) => {
          const state = m.reached ? "reached" : m.year != null ? "upcoming" : "beyond";
          return (
            <li key={m.key} className="flex flex-1 flex-col items-center gap-2 px-1 text-center">
              <span
                className={
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold " +
                  (state === "reached"
                    ? "bg-primary text-primary-foreground"
                    : state === "upcoming"
                      ? "border-2 border-primary bg-card text-primary"
                      : "border border-border bg-muted text-muted-foreground")
                }
              >
                {state === "reached" ? (
                  <Check className="h-4 w-4" />
                ) : state === "upcoming" ? (
                  <Flag className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                )}
              </span>
              <span className="text-xs leading-tight font-medium">{t(m.key)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{detail(m)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface Props {
  projectionData: ProjectionData;
  baseCurrency: string;
  hasAccounts?: boolean;
}

export function ProjectionView({ projectionData, baseCurrency, hasAccounts }: Props) {
  const { latestNetWorth, trailing12mSavings, annualSnapshots, hasData } = projectionData;
  const t = useTranslations("projections");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

  const currentYear = new Date().getFullYear();
  const lastHistoricalYear = annualSnapshots.at(-1)?.year ?? currentYear;

  const [annualExpenses, setAnnualExpenses] = useState(0);
  const [annualSavings, setAnnualSavings] = useState(Math.max(0, Math.round(trailing12mSavings)));
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [inflation, setInflation] = useState(2.5);
  const [lens, setLens] = useState<Lens>("nominal");
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
        inflation / 100,
        lastHistoricalYear,
      ),
    [
      latestNetWorth,
      annualExpenses,
      annualSavings,
      expectedReturn,
      withdrawalRate,
      inflation,
      lastHistoricalYear,
    ],
  );

  const { fireNumber, fireYear, yearsToFire, progressPct, points } = projection;

  const milestones = useMemo(
    () => buildMilestones(points, latestNetWorth, fireNumber),
    [points, latestNetWorth, fireNumber],
  );

  const chartData = useMemo((): ChartPoint[] => {
    if (!hasData) return [];
    const horizonYear = fireYear != null ? fireYear + 3 : lastHistoricalYear + DEFAULT_HORIZON;
    const historicalYears = new Set(annualSnapshots.map((s) => s.year));

    const result: ChartPoint[] = annualSnapshots.map((s) => ({
      year: s.year,
      historical: s.netWorth,
      projected: s.year === lastHistoricalYear ? s.netWorth : undefined,
      projectedReal: s.year === lastHistoricalYear ? s.netWorth : undefined,
    }));

    for (const p of points) {
      if (historicalYears.has(p.year)) continue;
      if (p.year > horizonYear) break;
      result.push({ year: p.year, projected: p.nominal, projectedReal: p.real });
    }

    return result.sort((a, b) => a.year - b.year);
  }, [annualSnapshots, points, hasData, fireYear, lastHistoricalYear]);

  // Headline projected value (lens-aware), at the FIRE year or the default horizon.
  const horizonYear = fireYear ?? lastHistoricalYear + DEFAULT_HORIZON;
  const horizonPoint = points.find((p) => p.year === horizonYear) ?? points.at(-1) ?? null;
  const projectedValue = horizonPoint
    ? lens === "real"
      ? horizonPoint.real
      : horizonPoint.nominal
    : 0;
  const animatedProjected = useCountUp(projectedValue, 650);

  const mask = (s: string) => (privacyMode ? "***" : s);

  if (!hasData) {
    return <ProjectionOnboarding hasAccounts={hasAccounts} />;
  }

  const hasExpenses = annualExpenses > 0;
  const reachable = fireYear != null;
  const alreadyFI = yearsToFire === 0;

  const headline = !hasExpenses
    ? t("resultNoExpenses")
    : alreadyFI
      ? t("resultAlready")
      : reachable
        ? t("resultReachable", { year: fireYear })
        : t("resultUnreachable", { years: MAX_YEARS });

  const subline = !hasExpenses
    ? t("resultNoExpensesHint")
    : alreadyFI || !reachable
      ? null
      : t("yearsAway", { years: yearsToFire ?? 0 });

  return (
    <div className={isCompact ? "space-y-3" : "space-y-4 lg:space-y-6"}>
      {/* Header row: subtitle + value lens */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <SegmentedControl
            size="sm"
            value={lens}
            onValueChange={(v) => setLens(v as Lens)}
            options={[
              { value: "nominal", label: t("lensNominal") },
              { value: "real", label: t("lensReal") },
            ]}
          />
          <p className="text-xs text-muted-foreground sm:text-right">
            {t(lens === "real" ? "lensHintReal" : "lensHintNominal")}
          </p>
        </div>
      </div>

      {/* Cockpit: assumptions rail + projection workspace */}
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Assumptions rail */}
        <aside className="order-last lg:order-none lg:sticky lg:top-6">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-sm font-semibold tracking-tight">{t("assumptions")}</h2>
              <div className="space-y-5">
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
                <SliderField
                  label={t("expectedReturn")}
                  value={expectedReturn}
                  onChange={setExpectedReturn}
                  min={0}
                  max={15}
                  step={0.5}
                  suffix="%"
                />
                <SliderField
                  label={t("inflationRate")}
                  hint={t("inflationRateHint")}
                  value={inflation}
                  onChange={setInflation}
                  min={0}
                  max={8}
                  step={0.1}
                  suffix="%"
                />
                <SliderField
                  label={t("withdrawalRate")}
                  hint={t("withdrawalRateHint")}
                  value={withdrawalRate}
                  onChange={setWithdrawalRate}
                  min={1}
                  max={8}
                  step={0.1}
                  suffix="%"
                />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Workspace */}
        <div className="min-w-0 space-y-4 lg:space-y-6">
          {/* Result band */}
          <Card className="rounded-2xl py-5 sm:py-6">
            <CardContent className="grid gap-6 px-5 sm:px-6 lg:grid-cols-[1.5fr_1fr] lg:items-stretch">
              <div className="space-y-3">
                {hasExpenses && reachable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    <Sparkles className="h-3 w-3" />
                    {t("onTrackLabel")}
                  </span>
                )}
                <h2 className="text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
                  {headline}
                </h2>
                {subline && <p className="text-sm text-muted-foreground">{subline}</p>}

                {hasExpenses && (
                  <div className="space-y-2 pt-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full origin-left rounded-full bg-primary transition-transform duration-700"
                        style={{
                          transform: `scaleX(${Math.max(0, Math.min(progressPct, 100)) / 100})`,
                          transitionTimingFunction: "var(--ease-out-expo)",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {mask(formatCurrency(latestNetWorth, baseCurrency, true))}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatNumber(progressPct, progressPct >= 10 ? 0 : 1)}%
                      </span>
                      <span className="tabular-nums">
                        {mask(formatCurrency(fireNumber, baseCurrency, true))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center lg:border-l lg:border-border/60 lg:pl-6">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("projectedPortfolio")}
                  <span className="ml-1 tabular-nums">
                    {t("projectedBy", { year: horizonYear })}
                  </span>
                </p>
                <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">
                  {mask(formatCurrency(animatedProjected, baseCurrency))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {mask(
                    t("fromToday", { amount: formatCurrency(latestNetWorth, baseCurrency, true) }),
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">{t("chart")}</h2>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {t("chartSubtitle")}
                </p>
              </div>
              <LazyProjectionChart
                data={chartData}
                fireNumber={fireNumber}
                fireYear={fireYear}
                baseCurrency={baseCurrency}
                lens={lens}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Milestones (full width, below the cockpit on desktop; after inputs on mobile) */}
      {milestones.length > 0 && (
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("milestonesTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("milestonesSubtitle")}</p>
            </div>
            <MilestoneTimeline milestones={milestones} t={t} />
          </CardContent>
        </Card>
      )}

      {/* Collapsible guide */}
      <Card className="border-border/50 bg-muted/30">
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

            <div className="space-y-3 rounded-lg bg-primary/8 px-4 py-4">
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
