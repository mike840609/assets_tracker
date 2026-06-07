"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus,
  Wallet,
  TrendingUp,
  Activity,
  BarChart3,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardOnboarding() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isZh = locale.startsWith("zh");

  // Localized checklist copy
  const checklist = {
    title: isZh ? "開始使用資產追蹤器" : "Get Started with Assets Tracker",
    subtitle: isZh
      ? "完成以下步驟以完全解鎖您的儀表板和圖表。"
      : "Complete these steps to fully unlock your dashboard and charts.",
    progress: (completed: number) =>
      isZh ? `已完成 ${completed} / 3 個步驟` : `${completed} of 3 steps completed`,
    steps: [
      {
        num: 1,
        title: isZh ? "連結您的第一個帳戶" : "Connect your first account",
        desc: isZh
          ? "連結銀行帳戶、投資或加密貨幣錢包以計算淨資產。"
          : "Link bank accounts, investments, or crypto wallets to compute net worth.",
        action: isZh ? "新增帳戶" : "Add Account",
        href: "/accounts",
      },
      {
        num: 2,
        title: isZh ? "設定一個目標" : "Establish a target goal",
        desc: isZh
          ? "設定儲蓄、投資或淨資產目標以追蹤整體進度。"
          : "Set savings, investment, or net worth milestones to track overall progress.",
        action: isZh ? "建立目標" : "Create Goal",
        href: "/goals",
      },
      {
        num: 3,
        title: isZh ? "分析資產表現" : "Analyze asset performance",
        desc: isZh
          ? "累積每日快照以檢視投資組合分配和歷史成長。"
          : "Accrue snapshots to review portfolio allocation and historical growth.",
        action: isZh ? "檢視分析" : "Review Analysis",
        href: "/analysis",
      },
    ],
  };

  return (
    <div className="relative isolate flex min-h-[75vh] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card mt-4 shadow-sm p-6 sm:p-12">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-8 opacity-25 blur-[6px] pointer-events-none select-none transition-all duration-700"
        aria-hidden="true"
      >
        {/* Mock Topbar */}
        <div className="flex justify-between items-center w-full mb-2">
          <div className="h-6 w-36 rounded bg-muted/70" />
          <div className="h-8 w-28 rounded-md bg-muted/60" />
        </div>

        {/* Mock Net Worth Summary */}
        <div className="grid grid-cols-3 gap-6 w-full">
          <Card className="col-span-3 rounded-xl bg-background border-border/50 shadow-sm">
            <CardContent className="p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div className="h-4 w-28 rounded bg-muted/60" />
              </div>
              <div className="h-8 w-48 rounded bg-foreground/20 mt-1" />
              <div className="flex items-center gap-2 mt-4">
                <div className="h-4 w-32 rounded bg-[var(--gain)]/20" />
                <div className="h-4 w-20 rounded bg-muted/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mock Grid (Performance & Allocation) */}
        <div className="grid grid-cols-2 gap-6 w-full">
          <Card className="rounded-xl bg-background border-border/50 shadow-sm h-44">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div className="h-4 w-24 rounded bg-muted/60" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 h-[calc(100%-2.5rem)] flex items-end relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-primary/20 to-transparent border-t border-primary/40" />
            </CardContent>
          </Card>
          <Card className="rounded-xl bg-background border-border/50 shadow-sm h-44">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div className="h-4 w-24 rounded bg-muted/60" />
              </div>
            </CardHeader>
            <CardContent className="p-4 flex items-center justify-center h-[calc(100%-2.5rem)]">
              <div className="h-20 w-20 rounded-full border-[10px] border-muted/30 border-t-primary border-r-primary/60" />
            </CardContent>
          </Card>
        </div>

        {/* Mock Accounts List */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full p-6 flex flex-col gap-4">
          <div className="h-4 w-24 rounded bg-muted/60" />
          <div className="space-y-3">
            {[
              { name: "Chase Checking", val: "$12,450.00" },
              { name: "Fidelity Brokerage", val: "$98,200.00" },
              { name: "Coinbase Wallet", val: "$13,850.00" },
            ].map((acc, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b border-border/20 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium text-foreground/75">{acc.name}</div>
                </div>
                <div className="font-mono text-sm font-semibold">{acc.val}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Foreground CTA Checklist Overlay Card */}
      <div className="relative z-10 flex w-full max-w-[500px] flex-col gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{checklist.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{checklist.subtitle}</p>
        </div>

        {/* Progress Tracker */}
        <div className="space-y-2 border-y border-border/40 py-4">
          <div className="flex justify-between text-xs font-semibold text-muted-foreground">
            <span>{checklist.progress(0)}</span>
            <span>0%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
            <div className="h-full w-0 bg-primary transition-all duration-500" />
          </div>
        </div>

        {/* Steps List */}
        <div className="flex flex-col gap-4">
          {checklist.steps.map((step) => (
            <div
              key={step.num}
              className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/10 transition-colors"
            >
              <div className="w-5 h-5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                {step.num}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="text-sm font-semibold text-foreground/90 leading-tight">
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground leading-normal">{step.desc}</div>
              </div>
              <Link
                href={step.href}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-7 rounded-lg text-xs font-semibold px-2.5 gap-1 shrink-0 select-none hover:bg-primary hover:text-primary-foreground border-border/60 transition-all",
                )}
              >
                {step.action}
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
