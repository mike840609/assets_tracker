"use client";

import { useTranslations } from "next-intl";
import { Plus, ChartCandlestick, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StocksOnboardingProps {
  onAdd: () => void;
}

export function StocksOnboarding({ onAdd }: StocksOnboardingProps) {
  const t = useTranslations("stocks");

  return (
    <div className="relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card mt-4 shadow-sm p-6 sm:p-12">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-8 opacity-30 blur-[5px] pointer-events-none select-none transition-all duration-700"
        aria-hidden="true"
      >
        {/* Mock Stock Indices Top Bar */}
        <div className="grid grid-cols-3 gap-4 w-full mb-2">
          {[
            { name: "S&P 500", val: "5,420.30", change: "+1.15%", gain: true },
            { name: "NASDAQ", val: "17,680.12", change: "+1.42%", gain: true },
            { name: "DOW JONES", val: "39,012.45", change: "-0.24%", gain: false },
          ].map((index, i) => (
            <Card
              key={i}
              className="rounded-xl bg-background border-border/50 shadow-sm p-4 flex flex-col gap-1"
            >
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                {index.name}
              </span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="font-mono text-xs font-bold">{index.val}</span>
                <span
                  className={cn(
                    "text-[10px] font-semibold flex items-center gap-0.5",
                    index.gain ? "text-[var(--gain)]" : "text-[var(--loss)]",
                  )}
                >
                  {index.gain ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {index.change}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Mock Stocks Watchlist */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full p-6 flex flex-col gap-4 flex-1 justify-between">
          <div className="h-4 w-32 rounded bg-muted/60" />
          <div className="space-y-4">
            {[
              {
                ticker: "AAPL",
                name: "Apple Inc.",
                price: "$192.40",
                cost: "$175.00",
                change: "+9.9%",
                gain: true,
              },
              {
                ticker: "NVDA",
                name: "NVIDIA Corp.",
                price: "$920.10",
                cost: "$780.00",
                change: "+17.9%",
                gain: true,
              },
              {
                ticker: "TSLA",
                name: "Tesla Inc.",
                price: "$170.20",
                cost: "$185.00",
                change: "-8.0%",
                gain: false,
              },
            ].map((stock, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b border-border/20 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                    {stock.ticker}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground/80 leading-tight">
                      {stock.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Recorded cost: {stock.cost}
                    </div>
                  </div>
                </div>
                <div className="flex gap-6 items-center">
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold">{stock.price}</div>
                  </div>
                  <div
                    className={cn(
                      "font-mono text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-0.5",
                      stock.gain
                        ? "text-[var(--gain)] bg-[var(--gain)]/10"
                        : "text-[var(--loss)] bg-[var(--loss)]/10",
                    )}
                  >
                    {stock.gain ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {stock.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Foreground CTA Overlay Card */}
      <div className="relative z-10 flex max-w-[460px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <ChartCandlestick className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground balance-text">
            {t("emptyTitle")}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">{t("emptyBody")}</p>
        </div>

        <div className="w-full pt-2">
          <Button
            onClick={onAdd}
            size="lg"
            className="w-full sm:w-auto gap-2 rounded-xl text-base font-medium transition-all active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            {t("addStock")}
          </Button>
        </div>

        <p className="text-xs lg:text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
