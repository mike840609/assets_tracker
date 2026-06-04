"use client";

import { useTranslations } from "next-intl";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { useCountUp } from "@/hooks/use-count-up";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { AnalysisKpis } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

interface Props {
  kpis: AnalysisKpis;
  baseCurrency: string;
  locale: string;
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
function CountUpMoney({
  amount,
  currency,
  compact = false,
}: {
  amount: number;
  currency: string;
  compact?: boolean;
}) {
  const value = useCountUp(amount, 700);
  const sign = amount > 0 ? "+" : "";
  return <>{`${sign}${formatCurrency(value, currency, compact)}`}</>;
}

// Direction is carried by a caret (icon, not color alone) per the gain/loss rule.
// Positives stay ink so the strip never reads as one saturated block; only a real
// loss recolors the number.
function DirectionCaret({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === "positive")
    return (
      <ArrowUpRight className={`text-[var(--gain)] shrink-0 ${className ?? ""}`} aria-hidden />
    );
  if (tone === "negative")
    return (
      <ArrowDownRight className={`text-[var(--loss)] shrink-0 ${className ?? ""}`} aria-hidden />
    );
  return null;
}

/**
 * Lead metric. Full-width band that anchors the strip: the value reads large on
 * the left, its rate sits as a pill on the right. This is the focal point the
 * four equal tiles used to lack.
 */
function HeroTile({
  title,
  amount,
  pct,
  currency,
  privacyMode,
  isCompact,
}: {
  title: string;
  amount: number | null;
  pct: string | null;
  currency: string;
  privacyMode: boolean;
  isCompact: boolean;
}) {
  const tone: Tone = privacyMode || amount === null ? "neutral" : toneFor(amount);
  const pillClass =
    tone === "negative"
      ? "bg-[var(--loss)]/10 text-[var(--loss)]"
      : tone === "positive"
        ? "bg-[var(--gain)]/10 text-[var(--gain)]"
        : "bg-muted text-muted-foreground";

  return (
    <Card className="min-w-0">
      <CardContent
        className={`flex items-center justify-between gap-3 ${isCompact ? "py-3" : "py-4"}`}
      >
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
          <div className="overflow-x-auto scrollbar-none">
            <div
              className={`flex items-center gap-1.5 font-semibold tracking-tight tabular-nums whitespace-nowrap ${
                isCompact ? "text-2xl" : "text-2xl sm:text-3xl"
              } ${tone === "negative" ? "text-[var(--loss)]" : "text-foreground"}`}
            >
              <DirectionCaret tone={tone} className={isCompact ? "size-5" : "size-6"} />
              <span>
                {privacyMode ? (
                  "***"
                ) : amount === null ? (
                  "—"
                ) : (
                  <CountUpMoney amount={amount} currency={currency} />
                )}
              </span>
            </div>
          </div>
        </div>
        {!privacyMode && pct && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${pillClass}`}
          >
            {pct}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Supporting metric. Smaller than the hero; three of these read as a peer cluster
 * (the monthly-change distribution) beneath the year headline.
 */
function Tile({
  title,
  amount,
  currency,
  privacyMode,
  subtitle,
  tone,
  isCompact,
}: {
  title: string;
  amount: number | null;
  currency: string;
  privacyMode: boolean;
  subtitle?: string;
  tone: Tone;
  isCompact: boolean;
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardContent className={isCompact ? "space-y-0.5 min-w-0" : "space-y-1 min-w-0"}>
        <div className="truncate text-xs font-medium text-muted-foreground">{title}</div>
        <div className="overflow-x-auto scrollbar-none">
          <div
            className={`flex items-center gap-1 font-semibold tracking-tight tabular-nums whitespace-nowrap ${
              isCompact ? "text-sm" : "text-base sm:text-lg"
            } ${tone === "negative" ? "text-[var(--loss)]" : "text-foreground"}`}
          >
            <DirectionCaret tone={tone} className="size-4" />
            <span>
              {privacyMode ? (
                "***"
              ) : amount === null ? (
                "—"
              ) : (
                <CountUpMoney amount={amount} currency={currency} compact />
              )}
            </span>
          </div>
        </div>
        {subtitle && (
          <div className="truncate text-xs tabular-nums text-muted-foreground">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiTiles({ kpis, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

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

  return (
    <div className={isCompact ? "space-y-2" : "space-y-3 sm:space-y-4"}>
      {/* Lead: the year headline. Fixed to YTD regardless of the range selector,
          so it stays the stable answer to "how's the year going". */}
      <HeroTile
        title={t("ytdGrowth")}
        amount={kpis.ytdDelta}
        pct={ytdPct}
        currency={baseCurrency}
        privacyMode={privacyMode}
        isCompact={isCompact}
      />

      {/* Supporting cluster: the monthly-change distribution over the selected
          range (the range chips drive these three, not the YTD lead). */}
      <div className={`grid grid-cols-3 ${isCompact ? "gap-2" : "gap-2 sm:gap-3"}`}>
        <Tile
          title={t("avgMonthly")}
          amount={kpis.avgMonthlyDelta}
          currency={baseCurrency}
          privacyMode={privacyMode}
          tone={privacyMode ? "neutral" : toneFor(kpis.avgMonthlyDelta)}
          isCompact={isCompact}
        />
        <Tile
          title={bestTitle}
          amount={kpis.best ? kpis.best.deltaNetWorth : null}
          currency={baseCurrency}
          privacyMode={privacyMode}
          subtitle={bestSub}
          tone={privacyMode ? "neutral" : kpis.best ? toneFor(kpis.best.deltaNetWorth) : "neutral"}
          isCompact={isCompact}
        />
        <Tile
          title={worstTitle}
          amount={kpis.worst ? kpis.worst.deltaNetWorth : null}
          currency={baseCurrency}
          privacyMode={privacyMode}
          subtitle={worstSub}
          tone={
            privacyMode ? "neutral" : kpis.worst ? toneFor(kpis.worst.deltaNetWorth) : "neutral"
          }
          isCompact={isCompact}
        />
      </div>
    </div>
  );
}
