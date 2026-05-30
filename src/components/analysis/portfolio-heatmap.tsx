"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import Link from "next/link";
import { Treemap } from "recharts";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { cn } from "@/lib/utils";
import type { NetWorthSummary } from "@/lib/types";

interface Props {
  summary: NetWorthSummary;
  baseCurrency: string;
  locale: string;
}

// On-tile label colors. Kept as literals (not the CSS chart tokens) because we
// derive a per-tile text color from each fill's measured luminance — the dark
// theme's chart ramp shifts lighter, which would silently break that contrast.
const TILE_INK = "oklch(0.21 0.03 260)";
const TILE_PAPER = "oklch(0.99 0.01 260)";

/** Parse an `oklch(L C H)` string into WCAG relative luminance (0–1). */
function oklchLuminance(color: string): number {
  const m = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return 0.5;
  const L = parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const h = (parseFloat(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  // OKLab → linear sRGB (Björn Ottosson's matrices), then Rec. 709 luminance.
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const r = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const g = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

const Y_INK = oklchLuminance(TILE_INK);
const Y_PAPER = oklchLuminance(TILE_PAPER);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Pick whichever of ink/paper has the stronger contrast against `fill`. */
function readableText(fill: string): string {
  const y = oklchLuminance(fill);
  return ratio(y, Y_INK) >= ratio(y, Y_PAPER) ? TILE_INK : TILE_PAPER;
}

// Light, vivid spectrum, largest share first. Lightness is held high enough
// that dark ink labels clear WCAG AA (4.5:1) on every hue, in both themes.
const TILE_PALETTE = [
  "oklch(0.7 0.14 155)", // Emerald
  "oklch(0.72 0.11 215)", // Sky
  "oklch(0.7 0.13 275)", // Indigo
  "oklch(0.72 0.15 330)", // Fuchsia
  "oklch(0.8 0.14 75)", // Amber
  "oklch(0.71 0.14 30)", // Coral
  "oklch(0.75 0.1 190)", // Teal
  "oklch(0.71 0.15 300)", // Violet
  "oklch(0.82 0.15 115)", // Lime
];
const TILE_TEXT = TILE_PALETTE.map(readableText);

// Cash reads as a quiet slate so it never competes with priced holdings.
const CASH_FILL = "oklch(0.74 0.015 260)";
const CASH_TEXT = readableText(CASH_FILL);

interface HeatNode {
  id: string;
  /** Tile label: account name at the top level, ticker symbol when drilled. */
  name: string;
  /** Secondary label for the list (category, or holding full name). */
  detail: string;
  size: number;
  /** Fraction of the relevant whole (total assets at top level, account when drilled). */
  share: number;
  fill: string;
  /** Per-tile label color, chosen for contrast against `fill`. */
  textColor: string;
  displayValue: string;
  isCash?: boolean;
  // Recharts' Treemap data type requires an index signature.
  [key: string]: unknown;
}

interface AccountNode extends HeatNode {
  children: HeatNode[];
  unpricedCount: number;
}

const heatmapConfig = {} satisfies ChartConfig;

export function PortfolioHeatmap({ summary, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();

  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fmt = (n: number, compact = false) => formatCurrency(n, baseCurrency, compact);
  const getCategoryLabel = (cat: string) =>
    tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat });

  const accountNodes = useMemo<AccountNode[]>(() => {
    const total = summary.totalAssets;
    if (total <= 0) return [];

    return summary.accounts
      .filter((a) => a.type === "ASSET" && a.totalValueInBaseCurrency > 0)
      .sort((a, b) => b.totalValueInBaseCurrency - a.totalValueInBaseCurrency)
      .map((a, i) => {
        const colorIndex = i % TILE_PALETTE.length;
        const fill = TILE_PALETTE[colorIndex];
        const priced = a.holdings.filter(
          (h) => h.marketValueInBaseCurrency !== null && h.marketValueInBaseCurrency > 0,
        );
        const unpricedCount = a.holdings.filter((h) => h.marketValueInBaseCurrency === null).length;
        const holdingsBase = priced.reduce(
          (s, h) => s + (h.marketValueInBaseCurrency as number),
          0,
        );
        const cashInBase = a.totalValueInBaseCurrency - holdingsBase;

        const children: HeatNode[] = priced
          .sort(
            (x, y) =>
              (y.marketValueInBaseCurrency as number) - (x.marketValueInBaseCurrency as number),
          )
          .map((h, j) => {
            const value = h.marketValueInBaseCurrency as number;
            const ci = (i + j + 1) % TILE_PALETTE.length;
            return {
              id: h.id,
              name: h.symbol,
              detail: h.name,
              size: value,
              share: value / a.totalValueInBaseCurrency,
              fill: TILE_PALETTE[ci],
              textColor: TILE_TEXT[ci],
              displayValue: fmt(value, true),
            };
          });

        if (cashInBase > 0) {
          children.push({
            id: `${a.id}__cash`,
            name: t("heatmapCash"),
            detail: t("heatmapCash"),
            size: cashInBase,
            share: cashInBase / a.totalValueInBaseCurrency,
            fill: CASH_FILL,
            textColor: CASH_TEXT,
            displayValue: fmt(cashInBase, true),
            isCash: true,
          });
        }

        return {
          id: a.id,
          name: a.name,
          detail: getCategoryLabel(a.category),
          size: a.totalValueInBaseCurrency,
          share: a.totalValueInBaseCurrency / total,
          fill,
          textColor: TILE_TEXT[colorIndex],
          displayValue: fmt(a.totalValueInBaseCurrency, true),
          children,
          unpricedCount,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, baseCurrency, locale]);

  const selected = selectedId ? (accountNodes.find((n) => n.id === selectedId) ?? null) : null;

  // The heatmap is the drill surface: top level shows accounts, and selecting
  // one re-tiles it with that account's holdings allocation. Recharts treats a
  // `children` array as nested structure, so feed it a flat, child-free copy
  // (the account tiles / holding tiles stay the leaves, and stay clickable).
  const treemapData = useMemo<HeatNode[]>(() => {
    const source = selected ? selected.children : accountNodes;
    return source.map((n) => ({
      id: n.id,
      name: n.name,
      detail: n.detail,
      size: n.size,
      share: n.share,
      fill: n.fill,
      textColor: n.textColor,
      displayValue: n.displayValue,
      isCash: n.isCash,
    }));
  }, [selected, accountNodes]);

  const treemapHeight = isCompact ? 220 : 280;

  const fmtPct = (share: number) => {
    const pct = share * 100;
    return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
  };

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="min-w-0 truncate text-base font-medium text-foreground">
            {t("heatmapTitle")}
          </CardTitle>
          {!privacyMode && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {t("heatmapTotalAssets")} {fmt(summary.totalAssets, true)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("heatmapSubtitle")}</p>
      </CardHeader>

      <CardContent className="px-2 sm:px-4 pb-4">
        {accountNodes.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t("heatmapEmpty")}
          </div>
        ) : !mounted ? (
          <div style={{ height: treemapHeight }} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
            <div
              aria-hidden={privacyMode || undefined}
              role="img"
              aria-label={`${t("heatmapTitle")}, ${selected ? selected.name : t("heatmapSubtitle")}`}
              className={cn(
                "transition-[filter] duration-300 lg:col-span-3",
                privacyMode && "blur-sm pointer-events-none select-none",
              )}
            >
              <ChartContainer
                config={heatmapConfig}
                className="w-full [&_.recharts-wrapper]:!cursor-default"
                style={{ height: treemapHeight }}
                initialDimension={{ width: 1, height: treemapHeight }}
              >
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  nameKey="name"
                  stroke="var(--card)"
                  isAnimationActive={isAnimationActive}
                  animationDuration={420}
                  onAnimationEnd={onAnimationEnd}
                  content={
                    <HeatTile
                      onSelect={selected ? undefined : (id) => setSelectedId(id)}
                      fmtPct={fmtPct}
                    />
                  }
                >
                  <ChartTooltip
                    content={
                      <HeatmapTooltip
                        shareLabel={
                          selected ? t("heatmapAccountShare") : t("heatmapPortfolioShare")
                        }
                        valueLabel={t("heatmapValue")}
                        privacyMode={privacyMode}
                        fmt={fmt}
                        fmtPct={fmtPct}
                      />
                    }
                  />
                </Treemap>
              </ChartContainer>
            </div>

            {/* Detail pane (right on desktop). The heatmap is the master; clicking a
                tile selects an account and swaps this pane to its holdings. */}
            <div className="lg:col-span-2">
              {selected ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 px-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="group -my-1 inline-flex min-h-9 items-center gap-1 rounded-md py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                      <span>{t("heatmapBack")}</span>
                    </button>
                    <Link
                      href={`/accounts/${selected.id}`}
                      className="group -my-1 inline-flex min-h-9 items-center gap-0.5 rounded-md py-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span>{t("heatmapViewAccount")}</span>
                      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>

                  <div className="flex items-center gap-2 px-2">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: selected.fill }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {selected.name}
                      </div>
                      <div className="truncate text-xs tabular-nums text-muted-foreground">
                        {selected.detail} · {privacyMode ? "••••" : fmt(selected.size)} ·{" "}
                        {privacyMode ? "••%" : fmtPct(selected.share)}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-0.5 lg:max-h-64 lg:overflow-y-auto lg:pr-1">
                    {selected.children.map((child) => (
                      <NodeRow
                        key={child.id}
                        node={child}
                        fmt={fmt}
                        fmtPct={fmtPct}
                        privacyMode={privacyMode}
                        isCompact={isCompact}
                      />
                    ))}
                  </ul>

                  {selected.unpricedCount > 0 && (
                    <p className="px-2 text-[11px] text-muted-foreground">
                      {t("heatmapUnpriced", { count: selected.unpricedCount })}
                    </p>
                  )}
                </div>
              ) : (
                <ul className="space-y-0.5 lg:max-h-80 lg:overflow-y-auto lg:pr-1">
                  {accountNodes.map((acc) => (
                    <NodeRow
                      key={acc.id}
                      node={acc}
                      fmt={fmt}
                      fmtPct={fmtPct}
                      privacyMode={privacyMode}
                      isCompact={isCompact}
                      shareLabel={t("heatmapPortfolioShare")}
                      onSelect={() => setSelectedId(acc.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared list row, used by both the account list and the holdings detail list.
// ---------------------------------------------------------------------------

function NodeRow({
  node,
  fmt,
  fmtPct,
  privacyMode,
  isCompact,
  onSelect,
  shareLabel = "",
}: {
  node: HeatNode;
  fmt: (n: number) => string;
  fmtPct: (share: number) => string;
  privacyMode?: boolean;
  isCompact: boolean;
  onSelect?: () => void;
  shareLabel?: string;
}) {
  const interactive = !!onSelect;
  const Row = interactive ? "button" : "div";
  const pct = privacyMode ? "••%" : fmtPct(node.share);
  return (
    <li>
      <Row
        {...(interactive
          ? {
              type: "button" as const,
              onClick: onSelect,
              "aria-label": `${node.name}, ${pct} ${shareLabel}`,
            }
          : {})}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors",
          isCompact ? "py-1" : "py-1.5",
          // Comfortable touch target for the tappable account rows (skip in
          // compact density, which is desktop-only and pointer-driven).
          interactive && !isCompact && "min-h-11",
          interactive &&
            "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: node.fill }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{node.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{node.detail}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm tabular-nums text-muted-foreground">
            {privacyMode ? "••••" : fmt(node.size)}
          </span>
          <span className="mt-0.5 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {pct}
          </span>
        </span>
        {interactive && <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />}
      </Row>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Treemap tile renderer. Recharts spreads each node's data fields into the
// content props, so name/fill/share/displayValue/id are available here.
// ---------------------------------------------------------------------------

interface TileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  id?: string;
  name?: string;
  fill?: string;
  textColor?: string;
  share?: number;
  displayValue?: string;
  onSelect?: (id: string) => void;
  fmtPct?: (share: number) => string;
}

function HeatTile({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  depth = 1,
  id,
  name,
  fill,
  textColor = TILE_PAPER,
  share,
  displayValue,
  onSelect,
  fmtPct,
}: TileProps) {
  // depth 0 is the synthetic root rect; only paint the leaf tiles.
  if (depth === 0 || width <= 0 || height <= 0) return null;

  const showName = width > 52 && height > 26;
  const showPct = showName && width > 64 && height > 42 && share != null && fmtPct;
  const showValue = showName && width > 88 && height > 62;
  const clickable = onSelect && id ? () => onSelect(id) : undefined;
  const pad = 7;

  return (
    <g
      onClick={clickable}
      style={{ cursor: clickable ? "pointer" : "default" }}
      className="transition-opacity hover:opacity-90"
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fill}
        fillOpacity={0.92}
        stroke="var(--card)"
        strokeWidth={2}
      />
      {showName && (
        <text
          x={x + pad}
          y={y + pad + 11}
          fill={textColor}
          fontSize={12}
          fontWeight={600}
          className="pointer-events-none select-none"
        >
          {clip(name ?? "", Math.floor((width - pad * 2) / 7))}
        </text>
      )}
      {showPct && (
        <text
          x={x + pad}
          y={y + pad + 27}
          fill={textColor}
          fontSize={11}
          fontWeight={500}
          className="pointer-events-none select-none tabular-nums"
        >
          {fmtPct(share as number)}
        </text>
      )}
      {showValue && (
        <text
          x={x + pad}
          y={y + height - pad}
          fill={textColor}
          fontSize={10}
          className="pointer-events-none select-none tabular-nums"
        >
          {displayValue}
        </text>
      )}
    </g>
  );
}

function clip(s: string, max: number): string {
  if (max < 3) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

interface TooltipNodePayload {
  payload: HeatNode;
}

function HeatmapTooltip({
  active,
  payload,
  shareLabel,
  valueLabel,
  privacyMode,
  fmt,
  fmtPct,
}: {
  active?: boolean;
  payload?: TooltipNodePayload[];
  shareLabel: string;
  valueLabel: string;
  privacyMode?: boolean;
  fmt: (n: number) => string;
  fmtPct: (share: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const node = payload[0].payload;
  if (!node?.name) return null;

  const titleNode = (
    <>
      <div className="leading-tight">{node.name}</div>
      {node.detail && node.detail !== node.name && (
        <div className="mt-0.5 text-[10px] font-normal leading-snug text-muted-foreground">
          {node.detail}
        </div>
      )}
    </>
  );

  return (
    <ChartTooltipContainer title={titleNode} className="min-w-[160px]">
      <ChartTooltipRow
        label={shareLabel}
        value={privacyMode ? "***" : fmtPct(node.share)}
        indicatorColor={node.fill}
      />
      <ChartTooltipRow label={valueLabel} value={privacyMode ? "***" : fmt(node.size)} />
    </ChartTooltipContainer>
  );
}
