"use client";

/* eslint-disable @next/next/no-img-element -- ponytail: one 28px remote avatar does not need image optimization. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChartCandlestick,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  History,
  LayoutDashboard,
  Search,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { usePrivacyMode } from "./privacy-mode-context";
import { useTranslations } from "next-intl";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { hapticTick } from "@/lib/haptics";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { AppIcon } from "./app-icon";

const SIDEBAR_STORAGE_KEY = "asset-tracker:sidebar-collapsed";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year
const SIDEBAR_SHORTCUT_HINT = "Ctrl+\\ (⌘\\ on Mac)";

// Mirror the collapsed flag into a cookie so the server can render the correct
// width on the next load (localStorage is client-only, which is what caused the
// expanded→collapsed flash on reload). localStorage stays the source of truth for
// in-session reads and cross-tab `storage` events.
function persistCollapsed(value: boolean) {
  const raw = value ? "1" : "0";
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, raw);
  document.cookie = `${SIDEBAR_STORAGE_KEY}=${raw}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
}

export function Sidebar({
  userImage,
  userName,
  defaultCollapsed = false,
  appVersion,
}: {
  userImage?: string | null;
  userName?: string | null;
  /** SSR seed read from the sidebar cookie, so the first paint matches the
   *  user's saved preference instead of always rendering expanded. */
  defaultCollapsed?: boolean;
  /** Passed in from the RSC layout so the (bilingual) changelog data never
   *  enters this client bundle — only the resolved version string does. */
  appVersion: string;
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
    // Server + hydration snapshot: the cookie value the server already rendered
    // with. Matching it here means no post-hydration width swap (no flash).
    () => defaultCollapsed,
  );

  // Keep the cookie aligned with localStorage on mount, covering users who saved
  // the preference before the cookie existed (otherwise their first reload after
  // this change would still flash once).
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "1" || stored === "0") {
      document.cookie = `${SIDEBAR_STORAGE_KEY}=${stored}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    persistCollapsed(!collapsed);
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
    { label: t("nav.goals"), href: "/goals", icon: Target },
    { label: t("nav.stocks"), href: "/stocks", icon: ChartCandlestick },
    { label: t("nav.analysis"), href: "/analysis", icon: BarChart3 },
    { label: t("nav.projections"), href: "/projections", icon: TrendingUp },
    { label: t("nav.history"), href: "/history", icon: History },
    { label: t("nav.settings"), href: "/settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar/80 backdrop-blur-md text-sidebar-foreground glass z-10 shrink-0",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("pt-6 pb-3 border-b border-border/50", collapsed ? "px-3" : "px-6")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <AppIcon
            gradientId="sidebar-icon-g"
            className="h-8 w-8 shrink-0 drop-shadow-lg dark:drop-shadow-[0_4px_12px_rgba(52,211,153,0.25)]"
          />
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{t("app.name")}</h1>
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
              <img
                src={userImage}
                width={28}
                height={28}
                alt={userName ?? "User avatar"}
                className="h-7 w-7 rounded-full"
              />
            ) : (
              <Link
                href="/changelog"
                title={t("nav.changelog")}
                // Low-traffic page in the always-visible footer: don't speculatively
                // prefetch its RSC payload for every user with the sidebar open.
                prefetch={false}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                v{appVersion}
              </Link>
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
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-sm transition-all motion-fast",
                    privacyMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="text-[11px] font-medium leading-none">
                    {privacyMode ? "Show" : "Hide"}
                  </span>
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
  const router = useRouter();
  const t = useTranslations();
  const hidden = useHideOnScroll();
  const [isPending, startTransition] = useTransition();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);

  // The mobile "Plan" tab opens the consolidated hub at /goals (Goals + Watchlist +
  // Projections sub-tabs). Labeled "Plan" so the watchlist/projections sub-views are
  // a discoverable promise — they have no slot of their own in the 5-item bar.
  const navItems = [
    { label: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("nav.accounts"), href: "/accounts", icon: Copy },
    { label: t("nav.plan"), href: "/goals", icon: Target },
    { label: t("nav.analysis"), href: "/analysis", icon: BarChart3 },
    { label: t("nav.history"), href: "/history", icon: History },
  ];

  const resolveActive = (href: string) =>
    isPending
      ? href === "/"
        ? optimisticHref === "/"
        : (optimisticHref?.startsWith(href) ?? false)
      : href === "/"
        ? pathname === "/"
        : pathname.startsWith(href);

  // The active "pill" is a single shared element that glides between tabs instead
  // of each button toggling its own background. We measure the active button's box
  // and translate the pill there; only `transform` is transitioned (the buttons are
  // equal-width, so width/height stay constant). `animate` gates the transition on
  // for one frame after the first measurement so the pill places itself on mount
  // without sliding in from the left edge. routes not in the tab bar (e.g. /history)
  // leave activeIndex at -1, hiding the pill.
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{
    x: number;
    w: number;
    y: number;
    h: number;
  } | null>(null);
  const [animate, setAnimate] = useState(false);
  const activeIndex = navItems.findIndex((item) => resolveActive(item.href));

  useEffect(() => {
    const measure = () => {
      const btn = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
      if (!btn) {
        setIndicator(null);
        return;
      }
      setIndicator({
        x: btn.offsetLeft,
        w: btn.offsetWidth,
        y: btn.offsetTop,
        h: btn.offsetHeight,
      });
    };
    measure();
    const nav = itemRefs.current[0]?.parentElement;
    if (!nav) return;
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [activeIndex]);

  useEffect(() => {
    if (indicator && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [indicator, animate]);

  return (
    <nav
      className={cn(
        "md:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 w-[calc(100%-1.5rem)] max-w-sm flex items-stretch gap-1 px-2 py-1.5 rounded-full border border-border/60 bg-background/95 dark:bg-card/95 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.15),0_4px_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_-6px_28px_-4px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3)] transition-transform motion-normal will-change-transform",
        hidden && "translate-y-[calc(100%+1.75rem+env(safe-area-inset-bottom))]",
      )}
    >
      {/* Sliding active-tab pill — sits behind the buttons. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 rounded-full bg-primary/15 dark:bg-primary/20",
          animate &&
            "transition-[transform,opacity] duration-[280ms] ease-[var(--ease-out-expo)] motion-reduce:transition-none",
        )}
        style={
          indicator
            ? {
                width: indicator.w,
                height: indicator.h,
                transform: `translate(${indicator.x}px, ${indicator.y}px)`,
                opacity: 1,
              }
            : { opacity: 0 }
        }
      />
      {navItems.map((item, i) => {
        const isActive = resolveActive(item.href);
        const Icon = item.icon;
        return (
          <button
            key={item.href}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            onTouchStart={() => {
              if (!isActive) router.prefetch(item.href);
            }}
            onClick={() => {
              if (isActive) return;
              hapticTick();
              setOptimisticHref(item.href);
              startTransition(() => {
                router.push(item.href);
              });
            }}
            className="group relative flex flex-1 basis-0 min-w-0 min-h-12 items-center justify-center rounded-full select-none touch-manipulation transition-transform motion-fast will-change-transform active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex w-full h-full flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-full text-[10px] font-medium tracking-tight normal-case transition-colors motion-normal",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon
                key={isActive ? "on" : "off"}
                className={cn(
                  "transition-transform motion-fast",
                  isActive ? "motion-safe:ios-tab-pop h-[20px] w-[20px]" : "h-[18px] w-[18px]",
                )}
              />
              <span className="truncate w-full text-center">{item.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
