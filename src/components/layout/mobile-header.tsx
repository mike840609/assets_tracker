"use client";

import { ThemeToggle } from "./theme-toggle";

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 left-0 right-0 z-50 glass border-b border-border/50 bg-background/60 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
      <div className="flex flex-col">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent">
          Asset Tracker
        </h1>
        <p className="text-[10px] text-muted-foreground font-medium -mt-1 opacity-80 uppercase tracking-wider">Net Worth</p>
      </div>
      <div className="scale-90 origin-right">
        <ThemeToggle />
      </div>
    </header>
  );
}
