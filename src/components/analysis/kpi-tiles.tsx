"use client";

import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Info } from "lucide-react";
import { formatCurrency } from "@/lib/currencies";
import { useCountUp } from "@/hooks/use-count-up";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import type { AnalysisKpis } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

interface Props {
  kpis: AnalysisKpis;
  baseCurrency: string;
  locale: string;
  rangeLabel: string;
  /** Range's investment return as a fraction (0.072 = +7.2%); null = not computable. */
  investmentReturnPct: number | null;
}

type Tone = "positive" | "negative" | "neutral";

function toneFor(n: number): Tone {
  if (n > 0) return "positive";
  if (n < 0) return "negative";
  return "neutral";
}

// Settles the figure to its value the way the dashboard hero does, so the strip
// reads as "freshly computed" on load and on each range change. Width is stable
// (tabular-nums) and the hook returns the final value under reduced motion.
function CountUpMoney({ amount, currency }: { amount: number; currency: string }) {
  const value = useCountUp(amount, 700);
  const sign = amount > 0 ? "+" : "";
  return <>{`${sign}${formatCurrency(value, currency)}`}</>;
}

// Direction is carried by a caret (icon, not color alone) per the gain/loss rule.
// Positives stay ink so the strip never reads as one saturated block; only a real
// loss recolors the number.
function DirectionCaret({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === "positive")
    return (
      <ArrowUpRight className={`text-[var(--gain-ink)] shrink-0 ${className ?? ""}`} aria-hidden />
    );
  if (tone === "negative")
    return (
      <ArrowDownRight
        className={`text-[var(--loss-ink)] shrink-0 ${className ?? ""}`}
        aria-hidden
      />
    );
  return null;
}

function MoneyValue({
  amount,
  currency,
  privacyMode,
  tone,
  isCompact,
  emphasis = "supporting",
  align = "left",
  display,
}: {
  amount: number | null;
  currency: string;
  privacyMode: boolean;
  tone: Tone;
  isCompact: boolean;
  emphasis?: "lead" | "supporting";
  align?: "left" | "right";
  display?: string;
}) {
  const isLead = emphasis === "lead";
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full items-start gap-1.5 font-semibold tabular-nums",
        align === "right" && "justify-end text-right",
        isLead
          ? isCompact
            ? "text-xl"
            : "text-xl sm:text-2xl"
          : isCompact
            ? "text-xs"
            : "text-sm",
        tone === "negative" ? "text-[var(--loss-ink)]" : "text-foreground",
      )}
    >
      <DirectionCaret
        tone={tone}
        className={isLead ? (isCompact ? "size-4" : "size-5") : "size-4"}
      />
      <span className="min-w-0 max-w-full leading-tight break-words [overflow-wrap:anywhere]">
        {privacyMode ? (
          "***"
        ) : amount === null ? (
          "—"
        ) : display !== undefined ? (
          display
        ) : (
          <CountUpMoney amount={amount} currency={currency} />
        )}
      </span>
    </div>
  );
}

/**
 * Lead metric. Full-width band that anchors the strip: the value reads large on
 * the left, its rate sits as a pill on the right. This is the focal point the
 * four equal tiles used to lack.
 */
function LeadMetric({
  title,
  helper,
  amount,
  pct,
  currency,
  privacyMode,
  isCompact,
}: {
  title: string;
  helper: string;
  amount: number | null;
  pct: string | null;
  currency: string;
  privacyMode: boolean;
  isCompact: boolean;
}) {
  const tone: Tone = privacyMode || amount === null ? "neutral" : toneFor(amount);
  const pillClass =
    tone === "negative"
      ? "bg-[var(--loss)]/10 text-[var(--loss-ink)]"
      : tone === "positive"
        ? "bg-[var(--gain)]/10 text-[var(--gain-ink)]"
        : "bg-muted text-muted-foreground";

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            <span>{title}</span>
          </div>
          <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{helper}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
        <MoneyValue
          amount={amount}
          currency={currency}
          privacyMode={privacyMode}
          tone={tone}
          isCompact={isCompact}
          emphasis="lead"
        />
        {!privacyMode && pct && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${pillClass}`}
          >
            {pct}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Supporting metric. Smaller than the hero; three of these read as a peer cluster
 * (the monthly-change distribution) beneath the year headline.
 */
function MetricRow({
  title,
  amount,
  currency,
  privacyMode,
  subtitle,
  tone,
  isCompact,
  display,
}: {
  title: string;
  amount: number | null;
  currency: string;
  privacyMode: boolean;
  subtitle?: string;
  tone: Tone;
  isCompact: boolean;
  display?: string;
}) {
  return (
    <div
      className={`grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-3 ${
        isCompact ? "py-1.5" : "py-2.5"
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs font-medium leading-tight text-muted-foreground">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] leading-tight tabular-nums text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      <div className="min-w-0 text-right">
        <MoneyValue
          amount={amount}
          currency={currency}
          privacyMode={privacyMode}
          tone={tone}
          isCompact={isCompact}
          align="right"
          display={display}
        />
      </div>
    </div>
  );
}

export function KpiTiles({ kpis, baseCurrency, locale, rangeLabel, investmentReturnPct }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const isMobile = useIsMobile();

  const bestSub =
    privacyMode || !kpis.best ? undefined : formatMonthLabel(kpis.best.monthKey, locale);
  const worstSub =
    privacyMode || !kpis.worst ? undefined : formatMonthLabel(kpis.worst.monthKey, locale);

  // When every month shares a sign, a "Worst Month" can be a gain (and a "Best
  // Month" a loss). Relabel to match the data so the title and value agree.
  const bestTitle =
    !privacyMode && kpis.best && kpis.best.deltaNetWorth < 0 ? t("smallestLoss") : t("bestMonth");
  const worstTitle =
    !privacyMode && kpis.worst && kpis.worst.deltaNetWorth >= 0
      ? t("smallestGain")
      : t("worstMonth");

  const ytdPct =
    privacyMode || kpis.ytdPct === null
      ? null
      : `${kpis.ytdPct >= 0 ? "+" : ""}${kpis.ytdPct.toFixed(1)}%`;

  const returnDisplay =
    investmentReturnPct === null
      ? undefined
      : `${investmentReturnPct >= 0 ? "+" : ""}${(investmentReturnPct * 100).toFixed(1)}%`;

  const metricRows = (
    <div className="mt-1 divide-y divide-border/60">
      <MetricRow
        title={t("portfolioReturn")}
        amount={investmentReturnPct}
        display={returnDisplay}
        currency={baseCurrency}
        privacyMode={privacyMode}
        subtitle={t("portfolioReturnHint")}
        tone={
          privacyMode || investmentReturnPct === null ? "neutral" : toneFor(investmentReturnPct)
        }
        isCompact={isCompact}
      />
      <MetricRow
        title={t("avgMonthly")}
        amount={kpis.avgMonthlyDelta}
        currency={baseCurrency}
        privacyMode={privacyMode}
        tone={privacyMode ? "neutral" : toneFor(kpis.avgMonthlyDelta)}
        isCompact={isCompact}
      />
      <MetricRow
        title={bestTitle}
        amount={kpis.best ? kpis.best.deltaNetWorth : null}
        currency={baseCurrency}
        privacyMode={privacyMode}
        subtitle={bestSub}
        tone={privacyMode ? "neutral" : kpis.best ? toneFor(kpis.best.deltaNetWorth) : "neutral"}
        isCompact={isCompact}
      />
      <MetricRow
        title={worstTitle}
        amount={kpis.worst ? kpis.worst.deltaNetWorth : null}
        currency={baseCurrency}
        privacyMode={privacyMode}
        subtitle={worstSub}
        tone={privacyMode ? "neutral" : kpis.worst ? toneFor(kpis.worst.deltaNetWorth) : "neutral"}
        isCompact={isCompact}
      />
    </div>
  );

  const methodologyBox = (
    <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-foreground/50" aria-hidden />
      <div className="min-w-0">
        <div className="font-medium text-foreground">{t("methodologyShortTitle")}</div>
        <p className="mt-0.5">{t("kpiMethodology", { range: rangeLabel })}</p>
        <p className="mt-0.5">{t("portfolioReturnMethodology")}</p>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-full min-w-0 flex-col", isCompact ? "gap-3" : "gap-4")}>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="min-w-0 text-sm font-semibold leading-tight text-foreground">
            {t("analysisSummary")}
          </h2>
          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/70">
            {rangeLabel}
          </span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          {t("analysisSummarySubtitle", { range: rangeLabel })}
        </p>
      </div>

      <section
        className={cn("min-w-0 border-t border-border/70", isCompact ? "pt-2.5" : "pt-3")}
        aria-label={t("ytdFixedSection")}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {t("ytdFixedSection")}
          </div>
          <div className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t("rangeYTD")}
          </div>
        </div>
        {/* Fixed regardless of the range selector, so it stays the stable answer to "how's the year going". */}
        <LeadMetric
          title={t("ytdGrowth")}
          helper={t("ytdFixedHint")}
          amount={kpis.ytdDelta}
          pct={ytdPct}
          currency={baseCurrency}
          privacyMode={privacyMode}
          isCompact={isCompact}
        />
      </section>

      {/* On mobile the lead YTD metric above is the headline; the range
          distribution and methodology fold away so the card doesn't dominate
          the scroll before the charts. Desktop (the side rail) shows it all. */}
      {isMobile ? (
        <details className="group/kpi min-w-0 border-t border-border/70 pt-2.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="text-xs font-semibold text-foreground">
              {t("selectedRangeMetrics", { range: rangeLabel })}
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/kpi:rotate-180"
              aria-hidden
            />
          </summary>
          {metricRows}
          <div className="mt-3 border-t border-border/70 pt-3">{methodologyBox}</div>
        </details>
      ) : (
        <>
          <section
            className={cn("min-w-0 border-t border-border/70", isCompact ? "pt-2.5" : "pt-3")}
            aria-label={t("selectedRangeMetrics", { range: rangeLabel })}
          >
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <div className="text-xs font-semibold text-foreground">
                {t("selectedRangeMetrics", { range: rangeLabel })}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                {t("rangeDistribution")}
              </div>
            </div>
            {metricRows}
          </section>

          <div className="mt-auto border-t border-border/70 pt-3">{methodologyBox}</div>
        </>
      )}
    </div>
  );
}
