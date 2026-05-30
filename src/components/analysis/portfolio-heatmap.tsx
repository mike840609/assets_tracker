"use client";

import { useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Treemap, type TreemapNode } from "recharts";
import { useDensity } from "@/components/layout/density-context";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useContainerWidth } from "@/hooks/use-container-size";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { formatCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import type { NetWorthSummary } from "@/lib/types";

const HIDDEN = "***";
const CASH_ID = "cash";
const HEATMAP_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-9)",
  "var(--chart-8)",
  "var(--chart-4)",
];

type HeatmapNode = {
  id: string;
  name: string;
  value: number;
  color: string;
  kind: "account" | "holding" | "cash";
  accountId?: string;
  portfolioShare: number;
  accountShare?: number;
  tone?: number;
  unpricedCount?: number;
  children?: HeatmapNode[];
};

type RenderNode = TreemapNode & HeatmapNode;

type HeatmapTileProps = TreemapNode & {
  activeNodeId: string | null;
};

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function shorten(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}...`;
}

function tileFill(color: string, active: boolean, tone = 64): string {
  const weight = Math.min(82, Math.max(34, tone + (active ? 8 : 0)));
  return `color-mix(in oklch, ${color} ${weight}%, var(--heatmap-tile-base))`;
}

function tintFill(color: string, weight = 14): string {
  return `color-mix(in oklch, ${color} ${weight}%, transparent)`;
}

function borderTint(color: string, weight = 34): string {
  return `color-mix(in oklch, ${color} ${weight}%, var(--border))`;
}

function toneFromShare(share: number, min = 42, max = 82): number {
  if (!Number.isFinite(share) || share <= 0) return min;
  const normalized = Math.min(1, Math.max(0, share / 100));
  return min + (max - min) * normalized ** 0.9;
}

function nodeShare(node: HeatmapNode): number {
  return node.kind === "account" ? node.portfolioShare : (node.accountShare ?? 0);
}

function HeatmapTile(props: HeatmapTileProps) {
  const node = props as unknown as RenderNode;
  const x = Number(node.x ?? 0);
  const y = Number(node.y ?? 0);
  const width = Number(node.width ?? 0);
  const height = Number(node.height ?? 0);
  const isActive = node.id === props.activeNodeId;
  const showLabel = width > 70 && height > 38;
  const showShare = width > 98 && height > 58;
  const maxChars = Math.max(3, Math.floor((width - 18) / 7));
  const share = nodeShare(node);

  if (!node.color || !Number.isFinite(node.value) || node.value <= 0) return null;

  const fill = tileFill(node.color, isActive, node.tone);

  return (
    <g style={{ cursor: "pointer" }}>
      <rect
        x={x}
        y={y}
        width={Math.max(0, width)}
        height={Math.max(0, height)}
        rx={0}
        ry={0}
        fill={fill}
      />
      {width > 2 && height > 2 && (
        <rect
          x={x + 0.5}
          y={y + 0.5}
          width={Math.max(0, width - 1)}
          height={Math.max(0, height - 1)}
          rx={0}
          ry={0}
          fill="none"
          stroke="var(--card)"
          strokeOpacity={0.58}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {isActive && width > 3 && height > 3 && (
        <rect
          x={x + 1.5}
          y={y + 1.5}
          width={Math.max(0, width - 3)}
          height={Math.max(0, height - 3)}
          rx={0}
          ry={0}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.72}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {showLabel && (
        <text x={x + 10} y={y + 19} pointerEvents="none">
          <tspan fill="var(--heatmap-tile-label)" className="text-[11px] font-semibold">
            {shorten(node.name, maxChars)}
          </tspan>
          {showShare && (
            <tspan
              x={x + 10}
              y={y + 35}
              fill="var(--heatmap-tile-label-muted)"
              className="text-[10px] font-medium tabular-nums"
            >
              {formatPercent(share)}
            </tspan>
          )}
        </text>
      )}
    </g>
  );
}

function accountChildren(account: NetWorthSummary["accounts"][number], cashLabel: string) {
  const holdings = account.holdings
    .filter((holding) => (holding.marketValueInBaseCurrency ?? 0) > 0)
    .map((holding) => ({
      id: holding.id,
      name: holding.name || holding.symbol,
      value: holding.marketValueInBaseCurrency ?? 0,
      kind: "holding" as const,
    }))
    .sort((a, b) => b.value - a.value);

  const holdingsTotal = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const cashValue = Math.max(0, account.totalValueInBaseCurrency - holdingsTotal);

  return [
    ...holdings,
    ...(cashValue > 0.01
      ? [
          {
            id: `${account.id}:${CASH_ID}`,
            name: cashLabel,
            value: cashValue,
            kind: "cash" as const,
          },
        ]
      : []),
  ];
}

export function PortfolioHeatmap({ summary }: { summary: NetWorthSummary }) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const isPhone = useIsMobile(640);
  const shouldReduceMotion = useReducedMotion();
  const chartSummaryId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartWidth = useContainerWidth(chartRef);
  const chartHeight = useMemo(() => {
    if (chartWidth === 0) return isCompact ? 220 : 280;
    if (chartWidth < 420) return Math.max(190, Math.round(chartWidth * 0.62));
    if (chartWidth < 760) return Math.max(240, Math.round(chartWidth * 0.55));
    return isCompact ? 220 : 280;
  }, [chartWidth, isCompact]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<HeatmapNode | null>(null);

  const accounts = useMemo(() => {
    const assetAccounts = summary.accounts.filter(
      (account) => account.type === "ASSET" && account.totalValueInBaseCurrency > 0,
    );
    const maxAccountValue = Math.max(
      0,
      ...assetAccounts.map((account) => account.totalValueInBaseCurrency),
    );

    return assetAccounts
      .map((account, index) => {
        const children = accountChildren(account, t("heatmapCashLabel"));
        const childTotal = children.reduce((sum, child) => sum + child.value, 0);
        const color = HEATMAP_COLORS[index % HEATMAP_COLORS.length];
        const portfolioShare =
          summary.totalAssets > 0
            ? (account.totalValueInBaseCurrency / summary.totalAssets) * 100
            : 0;
        const relativeDepthShare =
          maxAccountValue > 0 ? (account.totalValueInBaseCurrency / maxAccountValue) * 100 : 0;
        const unpricedCount = account.holdings.filter(
          (holding) => holding.currentPrice === null || holding.marketValueInBaseCurrency === null,
        ).length;

        return {
          id: account.id,
          name: account.name,
          value: account.totalValueInBaseCurrency,
          color,
          kind: "account" as const,
          tone: toneFromShare(relativeDepthShare, 34, 90),
          portfolioShare,
          unpricedCount,
          children: children.map((child, childIndex) => {
            const childPortfolioShare =
              summary.totalAssets > 0 ? (child.value / summary.totalAssets) * 100 : 0;
            const childAccountShare = childTotal > 0 ? (child.value / childTotal) * 100 : 0;

            return {
              ...child,
              accountId: account.id,
              color,
              tone: toneFromShare(childAccountShare, child.kind === "cash" ? 28 : 34, 90),
              portfolioShare: childPortfolioShare,
              accountShare: childAccountShare,
              id: `${account.id}:${child.id}:${childIndex}`,
            };
          }),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [summary.accounts, summary.totalAssets, t]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const topLevelChartData = useMemo(
    () =>
      accounts.map(({ children: _children, ...account }) => ({
        ...account,
      })),
    [accounts],
  );
  const chartData = selectedAccount?.children?.length
    ? selectedAccount.children
    : topLevelChartData;
  const currentDetail = activeNode ?? selectedAccount ?? accounts[0] ?? null;
  const unpricedCount = accounts.reduce((sum, account) => sum + (account.unpricedCount ?? 0), 0);

  const handleNodeClick = (node: TreemapNode) => {
    const heatmapNode = node as RenderNode;
    setActiveNode(heatmapNode);
    if (heatmapNode.kind === "account") setSelectedAccountId(heatmapNode.id);
  };

  const clearSelection = () => {
    setSelectedAccountId(null);
    setActiveNode(null);
  };

  const detailShareLabel =
    currentDetail?.kind === "account" ? t("heatmapPortfolioShare") : t("heatmapAccountShare");
  const detailShare =
    currentDetail?.kind === "account"
      ? (currentDetail.portfolioShare ?? 0)
      : (currentDetail?.accountShare ?? 0);
  const detailFill = currentDetail
    ? tileFill(currentDetail.color, true, currentDetail.tone)
    : "var(--muted-foreground)";
  const chartLabel = t("heatmapChartLabel", { count: accounts.length });
  const chartSummaryItems = chartData
    .slice(0, 3)
    .map((node) => `${node.name} ${formatPercent(nodeShare(node))}`)
    .join(", ");
  const chartSummary = selectedAccount
    ? t("heatmapChartSummaryAccount", {
        account: selectedAccount.name,
        items: chartSummaryItems,
      })
    : t("heatmapChartSummaryPortfolio", { items: chartSummaryItems });
  const heatmapStyle = {
    "--heatmap-tile-base": "color-mix(in oklch, var(--muted) 84%, var(--card))",
    "--heatmap-tile-label": "color-mix(in oklch, var(--foreground) 86%, var(--card))",
    "--heatmap-tile-label-muted": "color-mix(in oklch, var(--foreground) 62%, var(--card))",
  } as CSSProperties;

  const renderDetailCard = (className?: string) =>
    currentDetail ? (
      <div
        className={cn("rounded-xl border bg-muted/20 p-3", className)}
        style={{
          backgroundColor: tintFill(currentDetail.color, 9),
          borderColor: borderTint(currentDetail.color, 28),
        }}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-foreground/10"
            style={{ backgroundColor: detailFill }}
          />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{currentDetail.name}</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">{detailShareLabel}</p>
            <p className="tabular-nums font-medium">{formatPercent(detailShare)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{summary.baseCurrency}</p>
            <p className="tabular-nums font-medium">
              {privacyMode
                ? HIDDEN
                : formatCurrency(currentDetail.value, summary.baseCurrency, true)}
            </p>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full ring-1 ring-border/40"
          style={{ backgroundColor: tintFill(currentDetail.color, 10) }}
        >
          <div
            className={cn(
              "h-full rounded-full",
              shouldReduceMotion ? "transition-none" : "transition-[width] duration-300 ease-out",
            )}
            style={{
              width: `${Math.min(100, Math.max(0, detailShare))}%`,
              backgroundColor: detailFill,
            }}
          />
        </div>
      </div>
    ) : null;

  const renderMobileDetailStrip = (className?: string) =>
    currentDetail ? (
      <div
        className={cn(
          "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2",
          className,
        )}
        style={{
          backgroundColor: tintFill(currentDetail.color, 9),
          borderColor: borderTint(currentDetail.color, 28),
        }}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-foreground/10"
          style={{ backgroundColor: detailFill }}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{currentDetail.name}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {formatPercent(detailShare)}
          </span>
        </span>
        <span className="max-w-24 truncate text-right text-xs font-medium tabular-nums">
          {privacyMode ? HIDDEN : formatCurrency(currentDetail.value, summary.baseCurrency, true)}
        </span>
      </div>
    ) : null;

  return (
    <Card size={isCompact ? "sm" : "default"} style={heatmapStyle}>
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{t("heatmapTitle")}</CardTitle>
            <CardDescription>{t("heatmapSubtitle")}</CardDescription>
          </div>
          <div className="w-fit max-w-full shrink-0 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{t("heatmapTotalAssetsLabel")}</span>{" "}
            <span className="tabular-nums text-foreground">
              {privacyMode
                ? HIDDEN
                : formatCurrency(summary.totalAssets, summary.baseCurrency, true)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className={isCompact ? "space-y-3 pt-1" : "space-y-4 pt-1"}>
        {accounts.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
            {t("heatmapEmpty")}
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0">
                <div className="mb-2 flex min-h-8 items-center gap-2 overflow-hidden">
                  {selectedAccount && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      aria-label={t("heatmapBackLabel", { account: selectedAccount.name })}
                      className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:min-h-8 lg:px-2"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                      <span className="truncate">{selectedAccount.name}</span>
                    </button>
                  )}
                  {!selectedAccount && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("heatmapPortfolioShare")}
                    </p>
                  )}
                </div>
                {selectedAccount ? renderMobileDetailStrip("mb-3 sm:hidden") : null}
                <div
                  ref={chartRef}
                  className={cn(
                    "relative min-h-[190px] overflow-hidden bg-[color-mix(in_oklch,var(--muted)_24%,var(--card))] ring-1 ring-border/60 transition-[filter] duration-300 sm:min-h-[240px] lg:min-h-0",
                    privacyMode && "blur-sm pointer-events-none select-none",
                  )}
                  role={privacyMode ? undefined : "img"}
                  aria-label={privacyMode ? undefined : chartLabel}
                  aria-describedby={privacyMode ? undefined : chartSummaryId}
                  aria-hidden={privacyMode || undefined}
                >
                  <p id={chartSummaryId} className="sr-only">
                    {chartSummary}
                  </p>
                  {chartWidth > 0 && (
                    <Treemap
                      width={chartWidth}
                      height={chartHeight}
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      type="flat"
                      content={(props) => (
                        <HeatmapTile {...props} activeNodeId={activeNode?.id ?? null} />
                      )}
                      isAnimationActive={shouldReduceMotion ? false : "auto"}
                      isUpdateAnimationActive={shouldReduceMotion ? false : "auto"}
                      animationDuration={shouldReduceMotion ? 0 : 220}
                      animationEasing="ease-out"
                      onMouseEnter={(node) => setActiveNode(node as RenderNode)}
                      onClick={handleNodeClick}
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                {renderDetailCard("hidden sm:block")}

                {selectedAccount?.children && selectedAccount.children.length > 0 ? (
                  <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-border/60 bg-muted/10 sm:max-h-[18rem] lg:max-h-[23rem]">
                    {selectedAccount.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setActiveNode(child)}
                        onFocus={() => setActiveNode(child)}
                        onMouseEnter={() => setActiveNode(child)}
                        aria-pressed={activeNode?.id === child.id}
                        className={cn(
                          "grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:min-h-10",
                          activeNode?.id === child.id &&
                            "bg-[color:var(--heatmap-child-active-bg)] ring-1 ring-inset ring-[color:var(--heatmap-child-active-border)]",
                        )}
                        style={
                          {
                            "--heatmap-child-active-bg": tintFill(child.color, 10),
                            "--heatmap-child-active-border": borderTint(child.color, 28),
                          } as CSSProperties
                        }
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-foreground/10"
                          style={{ backgroundColor: tileFill(child.color, false, child.tone) }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{child.name}</span>
                          <span
                            className={cn(
                              "mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs",
                              isPhone ? "justify-start" : "justify-between",
                            )}
                          >
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                              {formatPercent(child.accountShare ?? 0)}
                            </span>
                            <span className="min-w-0 truncate font-medium tabular-nums">
                              {privacyMode
                                ? HIDDEN
                                : formatCurrency(child.value, summary.baseCurrency, true)}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex snap-x gap-2 overflow-x-auto pb-1 pr-1 sm:grid sm:max-h-[18rem] sm:grid-cols-2 sm:gap-1.5 sm:overflow-x-visible sm:overflow-y-auto lg:block lg:max-h-[23rem] lg:space-y-1.5">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          setSelectedAccountId(account.id);
                          setActiveNode(account);
                        }}
                        onFocus={() => setActiveNode(account)}
                        onMouseEnter={() => setActiveNode(account)}
                        aria-pressed={selectedAccountId === account.id}
                        className={cn(
                          "grid min-h-11 w-40 shrink-0 snap-start grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-full md:min-h-10",
                          activeNode?.id === account.id || selectedAccountId === account.id
                            ? "border-[color:var(--heatmap-active-border)] bg-[color:var(--heatmap-active-bg)]"
                            : "border-transparent hover:bg-muted/60",
                        )}
                        style={
                          {
                            "--heatmap-active-bg": tintFill(account.color, 12),
                            "--heatmap-active-border": borderTint(account.color, 34),
                          } as CSSProperties
                        }
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-foreground/10"
                          style={{ backgroundColor: tileFill(account.color, false, account.tone) }}
                        />
                        <span className="min-w-0">
                          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2 lg:flex-col lg:items-stretch xl:flex-row xl:items-baseline">
                            <span className="block truncate text-sm font-medium">
                              {account.name}
                            </span>
                            <span className="shrink-0 truncate text-xs font-medium tabular-nums sm:max-w-[46%] sm:text-right lg:max-w-none lg:text-left xl:max-w-[46%] xl:text-right">
                              {privacyMode
                                ? HIDDEN
                                : formatCurrency(account.value, summary.baseCurrency, true)}
                            </span>
                          </span>
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {formatPercent(account.portfolioShare)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {unpricedCount > 0 && !privacyMode && (
              <p className="text-xs text-muted-foreground">
                {t("heatmapUnpricedNote", { count: unpricedCount })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
