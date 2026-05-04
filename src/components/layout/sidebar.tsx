"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, History, LayoutDashboard, Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { hapticTick } from "@/lib/haptics";
import { useEffect, useState } from "react";

const SIDEBAR_STORAGE_KEY = "asset-tracker:sidebar-collapsed";

export function Sidebar({ userImage, userName }: { userImage?: string | null; userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const navItems = [
    { label: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("nav.accounts"), href: "/accounts", icon: Copy },
    { label: t("nav.analysis"), href: "/analysis", icon: BarChart3 },
    { label: t("nav.history"), href: "/history", icon: History },
    { label: t("nav.settings"), href: "/settings", icon: Settings },
  ];

  return (
    <aside className={cn("hidden md:flex flex-col border-r bg-sidebar/80 backdrop-blur-md text-sidebar-foreground glass z-10 shrink-0 transition-[width] duration-200 ease-spring", collapsed ? "w-[72px]" : "w-64")}>
      <div className={cn("pt-6 pb-3 border-b border-border/50", collapsed ? "px-3" : "px-6")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-8 w-8 shrink-0 drop-shadow-lg dark:drop-shadow-[0_4px_12px_rgba(52,211,153,0.25)]">
            <defs>
              <linearGradient id="sidebar-icon-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399"/>
                <stop offset="100%" stopColor="#065f46"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="url(#sidebar-icon-g)"/>
            <path d="M8 20 L13.5 13.5 L17.5 17.5 L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 10 L24 10 L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent">{t("app.name")}</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{t("app.subtitle")}</p>
            </div>
          )}
        </div>
      </div>
      <nav className={cn("flex-1 space-y-2 mt-4", collapsed ? "px-2" : "px-3")}>
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
              prefetch={false}
              onMouseEnter={() => router.prefetch(item.href)}
              onFocus={() => router.prefetch(item.href)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ease-spring",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive
                  ? "text-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20 transition-all duration-200 ease-spring" />
              )}
              {!isActive && (
                <div className="absolute inset-0 rounded-lg bg-sidebar-accent/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10" />
              )}
              <Icon className={cn("z-10 h-5 w-5 transition-transform duration-200 ease-spring", isActive ? "scale-110" : "group-hover:scale-110")} />
              {!collapsed && <span className="z-10">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50 bg-background/30 backdrop-blur-md">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (userImage ? (
            <Image
              src={userImage}
              priority
              width={28}
              height={28}
              alt={userName ?? "User avatar"}
              className="rounded-full"
            />
          ) : (
            <span className="text-xs text-muted-foreground">v0.1.0</span>
          ))}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 ease-spring"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={togglePrivacyMode}
              title={privacyMode ? "Show values" : "Hide values"}
              aria-label={privacyMode ? "Show values" : "Hide values"}
              className={cn(
                "inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-all duration-200 ease-spring",
                privacyMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const hidden = useHideOnScroll();

  const navItems = [
    { label: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("nav.accounts"), href: "/accounts", icon: Copy },
    { label: t("nav.analysis"), href: "/analysis", icon: BarChart3 },
    { label: t("nav.history"), href: "/history", icon: History },
    { label: t("nav.settings"), href: "/settings", icon: Settings },
  ];

  return (
    <nav className={cn(
      "md:hidden fixed bottom-0 left-0 right-0 z-50 glass backdrop-blur-md border-t border-border/50 flex justify-around py-3 pb-safe transition-transform duration-300 ease-out-expo",
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
            onClick={hapticTick}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-3 py-1 text-xs transition-colors group",
              isActive
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <div className="absolute inset-x-2 -top-3 h-0.5 bg-primary rounded-b-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] shadow-primary/50 transition-all duration-200" />
            )}
            <Icon className={cn("h-5 w-5 transition-transform duration-200 ease-spring", isActive ? "scale-110" : "group-hover:scale-110")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
