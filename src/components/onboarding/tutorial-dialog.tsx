"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type TutorialDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/* ---------- Step preview components (self-contained, no app imports) ---------- */

function NetWorthPreview() {
  const cards = [
    { label: "Net Worth", value: "$42,350", color: "text-foreground" },
    { label: "Total Assets", value: "$48,350", color: "text-green-600 dark:text-green-400" },
    { label: "Total Liabilities", value: "$6,000", color: "text-red-500 dark:text-red-400" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
          <p className={cn("text-xl font-bold tabular-nums", c.color)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function AllocationPreview() {
  const segments = [
    { label: "Bank", pct: 26, color: "bg-blue-500" },
    { label: "Brokerage", pct: 59, color: "bg-violet-500" },
    { label: "Crypto", pct: 15, color: "bg-orange-500" },
  ];
  return (
    <div className="w-full space-y-4">
      {/* Bar */}
      <div className="flex h-6 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn("h-full", s.color)}
            style={{ width: `${s.pct}%` }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className={cn("inline-block h-3 w-3 rounded-full", s.color)} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium">{s.pct}%</span>
          </div>
        ))}
      </div>
      {/* Mini donut hint */}
      <p className="text-xs text-muted-foreground italic">
        Interactive donut chart available on the dashboard
      </p>
    </div>
  );
}

function AccountsPreview() {
  const rows = [
    { name: "Chase Checking", category: "Bank", type: "Asset", value: "$12,500", assetColor: "text-green-600 dark:text-green-400" },
    { name: "Fidelity Brokerage", category: "Brokerage", type: "Asset", value: "$28,350", assetColor: "text-green-600 dark:text-green-400" },
    { name: "Crypto Wallet", category: "Crypto", type: "Asset", value: "$7,500", assetColor: "text-green-600 dark:text-green-400" },
    { name: "Visa Credit Card", category: "Credit Card", type: "Liability", value: "−$6,000", assetColor: "text-red-500 dark:text-red-400" },
  ];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Account</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {r.category}
                </span>
              </td>
              <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", r.assetColor)}>
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoldingsPreview() {
  const rows = [
    { symbol: "AAPL", name: "Apple Inc.", type: "Stock", qty: "15", price: "$213.49", value: "$3,202" },
    { symbol: "VTI", name: "Vanguard Total Stock Mkt ETF", type: "ETF", qty: "20", price: "$286.41", value: "$5,728" },
    { symbol: "MSFT", name: "Microsoft Corporation", type: "Stock", qty: "10", price: "$415.50", value: "$4,155" },
  ];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Symbol</th>
            <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Type</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Price</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">
                <span className="font-mono font-semibold">{r.symbol}</span>
                <p className="text-xs text-muted-foreground truncate max-w-[120px]">{r.name}</p>
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {r.type}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.price}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinishPreview() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <svg
          className="h-10 w-10 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">5 features · 1 minute · 0 setup required</p>
        <p className="text-xs text-muted-foreground">Add your first account to start tracking your real net worth.</p>
      </div>
    </div>
  );
}

/* ---------- Step definitions ---------- */

const STEP_PREVIEWS = [
  NetWorthPreview,
  AllocationPreview,
  AccountsPreview,
  HoldingsPreview,
  FinishPreview,
];

const STEP_KEYS = ["netWorth", "allocation", "accounts", "holdings", "finish"] as const;

/* ---------- Main dialog ---------- */

export function TutorialDialog({ open, onOpenChange }: TutorialDialogProps) {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(0);
  const totalSteps = STEP_PREVIEWS.length;
  const isLast = step === totalSteps - 1;
  const StepPreview = STEP_PREVIEWS[step];
  const stepKey = STEP_KEYS[step];

  function handleClose() {
    onOpenChange(false);
    // Reset step so next open (from Settings) starts fresh
    setStep(0);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl w-full p-0"
      >
        {/*
          Single child div so the base DialogContent grid stays happy (1 row, no gap issues).
          Flex column with max-h keeps the footer always visible; the body scrolls if needed.
        */}
        <div className="flex flex-col max-h-[90svh] overflow-hidden rounded-xl">
          {/* Scrollable body: preview + text */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Preview area */}
            <div className="flex min-h-[220px] items-center justify-center bg-muted/30 px-6 py-6">
              <div className="w-full max-w-lg">
                <StepPreview />
              </div>
            </div>

            {/* Text content */}
            <div className="px-6 pt-4 pb-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {t(`steps.${stepKey}.title`)}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-1">
                  {t(`steps.${stepKey}.description`)}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Pinned footer — never clipped */}
          <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-y-3 px-6 py-4 border-t border-border/50 bg-popover">
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-block h-2 rounded-full transition-all duration-200",
                    i === step
                      ? "w-5 bg-primary"
                      : "w-2 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
              >
                {t("skip")}
              </button>
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  {t("previous")}
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={handleClose}>
                  {t("getStarted")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                  {t("next")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
