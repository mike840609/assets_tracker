"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, LayoutDashboard, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: Copy,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar/80 backdrop-blur-md text-sidebar-foreground glass z-10 shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent">Asset Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">Net Worth Dashboard</p>
      </div>
      <nav className="flex-1 px-3 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300",
                isActive
                  ? "text-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              {/* Subtle hover effect for non-active items */}
              {!isActive && (
                <div className="absolute inset-0 rounded-lg bg-sidebar-accent/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
              )}
              <Icon className={cn("z-10 h-5 w-5 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
              <span className="z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50 bg-background/30 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">v0.1.0</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    let lastY = 0;
    let touchStartY = 0;

    // Read scroll position from whichever container is actually scrolling.
    // On most browsers main scrolls; on iOS Safari the viewport may scroll instead.
    const getScrollY = () => Math.max(main?.scrollTop ?? 0, window.scrollY);

    const onScroll = () => {
      const y = getScrollY();
      if (y > lastY && y > 64) setHidden(true);
      else if (y < lastY) setHidden(false);
      lastY = y;
    };

    // Touch direction — fallback for browsers that throttle scroll events
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const delta = touchStartY - e.touches[0].clientY;
      if (delta > 10) setHidden(true);
      else if (delta < -10) setHidden(false);
    };

    main?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      main?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <nav className={cn(
      "md:hidden fixed bottom-0 left-0 right-0 z-50 glass backdrop-blur-md border-t border-border/50 flex justify-around py-3 pb-safe transition-transform duration-300 ease-in-out",
      hidden && "translate-y-full"
    )}>
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-3 py-1 text-xs transition-colors group",
              isActive
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-active"
                className="absolute inset-x-2 -top-3 h-0.5 bg-primary rounded-b-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] shadow-primary/50"
              />
            )}
            <Icon className={cn("h-5 w-5 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
