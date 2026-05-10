"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  History,
  LayoutDashboard,
  Search,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { hapticTick } from "@/lib/haptics";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const SIDEBAR_STORAGE_KEY = "asset-tracker:sidebar-collapsed";
const SIDEBAR_SHORTCUT_HINT = "Ctrl+\\ (⌘\\ on Mac)";

export function Sidebar({
  userImage,
  userName,
}: {
  userImage?: string | null;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const collapsed = useSyncExternalStore(
    (onStoreChange) => {
      const handleChange = () => onStoreChange();
      window.addEventListener("storage", handleChange);
      window.addEventListener("sidebar-collapsed-change", handleChange);
      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener("sidebar-collapsed-change", handleChange);
      };
    },
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1",
    () => false,
  );

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event("sidebar-collapsed-change"));
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "\\" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleCollapsed();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("sidebar:toggle", toggleCollapsed);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("sidebar:toggle", toggleCollapsed);
    };
  }, [toggleCollapsed]);

  const navItems = [
    { label: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("nav.accounts"), href: "/accounts", icon: Copy },
    { label: t("nav.analysis"), href: "/analysis", icon: BarChart3 },
    { label: t("nav.history"), href: "/history", icon: History },
    { label: t("nav.settings"), href: "/settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar/80 backdrop-blur-md text-sidebar-foreground glass z-10 shrink-0 transition-[width] motion-normal",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("pt-6 pb-3 border-b border-border/50", collapsed ? "px-3" : "px-6")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            fill="none"
            className="h-8 w-8 shrink-0 drop-shadow-lg dark:drop-shadow-[0_4px_12px_rgba(52,211,153,0.25)]"
          >
            <defs>
              <linearGradient id="sidebar-icon-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#065f46" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="url(#sidebar-icon-g)" />
            <path
              d="M8 20 L13.5 13.5 L17.5 17.5 L24 10"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 10 L24 10 L24 14"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent">
                {t("app.name")}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {t("app.subtitle")}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("command-palette:open"))}
          title={`${t("commandPalette.searchHint")} (⌘K)`}
          aria-label="Open command palette"
          aria-keyshortcuts="Control+K Meta+K"
          className={cn(
            "w-full flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground hover:border-border",
            collapsed ? "justify-center p-2" : "px-3 py-2",
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{t("commandPalette.searchHint")}</span>
              <kbd className="text-xs bg-background/60 border border-border/50 rounded px-1.5 py-0.5 font-mono leading-none">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>
      <nav className={cn("flex-1 space-y-2 mt-2", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
                "group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-all motion-fast",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive
                  ? "text-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-foreground",
              )}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20 transition-all motion-fast" />
              )}
              {!isActive && (
                <div className="absolute inset-0 rounded-lg bg-sidebar-accent/50 opacity-0 group-hover:opacity-100 transition-opacity motion-fast -z-10" />
              )}
              <Icon
                className={cn(
                  "z-10 h-5 w-5 transition-transform motion-fast",
                  isActive ? "scale-110" : "group-hover:scale-110",
                )}
              />
              {!collapsed && <span className="z-10">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50 bg-background/30 backdrop-blur-md">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed &&
            (userImage ? (
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
              title={`${collapsed ? "Expand sidebar" : "Collapse sidebar"} (${SIDEBAR_SHORTCUT_HINT})`}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-keyshortcuts="Control+\\ Meta+\\"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-sm text-muted-foreground hover:text-foreground transition-all motion-fast"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            {!collapsed && (
              <>
                <button
                  onClick={togglePrivacyMode}
                  title={privacyMode ? "Show values" : "Hide values"}
                  aria-label={privacyMode ? "Show values" : "Hide values"}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-all motion-fast",
                    privacyMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <ThemeToggle />
              </>
            )}
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
    <nav
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-50 glass backdrop-blur-md border-t border-border/50 flex justify-around py-3 pb-safe transition-transform motion-normal",
        hidden && "translate-y-full",
      )}
    >
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            onClick={() => {
              if (!isActive) hapticTick();
            }}
            className={cn(
              "relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 px-4 py-2 text-[10px] uppercase tracking-wider transition-all group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "text-primary font-semibold bg-primary/10 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-transform motion-fast",
                isActive ? "scale-110" : "group-hover:scale-110",
              )}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
