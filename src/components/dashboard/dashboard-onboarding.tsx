import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Wallet, PieChart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export async function DashboardOnboarding() {
  const t = await getTranslations("dashboard");

  return (
    <div className="relative isolate flex min-h-[75vh] flex-col">
      {/* 
        Background Mockup: A blurred, desaturated preview of the real dashboard 
        This demonstrates the value of the product (the "aha moment") immediately.
      */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 overflow-hidden opacity-40 mix-blend-luminosity blur-[6px] pointer-events-none select-none transition-all duration-1000 animate-mockup-breathe"
        aria-hidden="true"
      >
        <div className="flex items-center justify-end mb-2">
          <div className="h-8 w-28 rounded-md bg-muted/60" />
        </div>

        {/* Mock Net Worth Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <Card className="col-span-2 rounded-2xl bg-card border-border/40 shadow-sm">
            <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary/60" />
                </div>
                <div className="h-4 w-20 rounded bg-muted/60" />
              </div>
              <div className="h-8 w-40 rounded bg-foreground/20 mt-1" />
              <div className="h-5 w-28 rounded bg-emerald-500/20 mt-3" />
            </CardContent>
          </Card>
          {[0, 1].map((i) => (
            <Card key={i} className="col-span-1 rounded-2xl bg-card border-border/40 shadow-sm">
              <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-4 w-4 rounded-sm bg-muted/60" />
                  <div className="h-4 w-16 rounded bg-muted/60" />
                </div>
                <div className="h-6 w-24 rounded bg-foreground/20 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mock Charts & Goals Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
          <div className="lg:col-span-8">
            <Card className="h-[320px] bg-card border-border/40 shadow-sm">
              <CardHeader className="pb-2">
                <div className="h-5 w-32 rounded bg-muted/60" />
              </CardHeader>
              <CardContent className="flex flex-col justify-end h-[calc(100%-60px)]">
                {/* Abstract Area Chart Mock */}
                <div className="w-full h-[180px] bg-gradient-to-t from-primary/10 to-transparent rounded-t-sm border-t border-primary/20 relative">
                  <div className="absolute inset-x-0 bottom-0 h-px bg-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-3 sm:gap-6 lg:col-span-4">
            <Card className="h-[120px] bg-card border-border/40 shadow-sm">
              <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/10" />
                  <div className="h-4 w-24 rounded bg-muted/60" />
                </div>
                <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full w-[65%] bg-primary/40 rounded-full" />
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1 min-h-[176px] bg-card border-border/40 shadow-sm">
              <CardContent className="h-full flex items-center justify-center p-6">
                <div className="h-28 w-28 rounded-full border-[12px] border-muted/30 border-t-primary/30 border-r-primary/20" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 
        Foreground CTA Modal 
        A focused card that floats over the blurred dashboard.
      */}
      <div className="relative z-10 m-auto mt-[12vh] flex max-w-[440px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-md backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <TrendingUp className="h-10 w-10 text-primary" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("emptyTitle")}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed balance-text">
            {t("emptyDescription")}
          </p>
        </div>

        <div className="w-full pt-2">
          <Link
            href="/accounts"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("emptyAction")}
          </Link>
        </div>

        {/* Security / Trust snippet below the CTA */}
        <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
