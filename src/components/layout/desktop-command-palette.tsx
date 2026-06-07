"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  ChartCandlestick,
  Copy,
  History,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import { signOut } from "next-auth/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { usePrivacyMode } from "./privacy-mode-context";

export function DesktopCommandPalette() {
  const [open, setOpen] = useState(false);
  const [isMac] = useState(
    () => typeof window !== "undefined" && navigator.userAgent.includes("Mac"),
  );
  const router = useRouter();
  const t = useTranslations();
  const { togglePrivacyMode } = usePrivacyMode();
  const pendingGoTo = useRef(false);
  const goToTimeoutRef = useRef<number | null>(null);

  const navItems = useMemo(
    () => [
      { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, kbd: "1" },
      { href: "/accounts", label: t("nav.accounts"), icon: Copy, kbd: "2" },
      { href: "/goals", label: t("nav.goals"), icon: Target, kbd: "3" },
      { href: "/stocks", label: t("nav.stocks"), icon: ChartCandlestick, kbd: "4" },
      { href: "/analysis", label: t("nav.analysis"), icon: BarChart3, kbd: "5" },
      { href: "/projections", label: t("nav.projections"), icon: TrendingUp, kbd: "6" },
      { href: "/history", label: t("nav.history"), icon: History, kbd: "7" },
      { href: "/settings", label: t("nav.settings"), icon: Settings, kbd: "8" },
    ],
    [t],
  );

  const triggerRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent("prices:refresh"));
  }, []);
  const toggleSidebar = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sidebar:toggle"));
  }, []);
  const triggerNewItem = useCallback(() => {
    window.dispatchEvent(new CustomEvent("new-item"));
  }, []);
  const triggerAddItem = useCallback(() => {
    window.dispatchEvent(new CustomEvent("add-item"));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("input,textarea,[contenteditable=true]")) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.code === "Semicolon") {
        e.preventDefault();
        togglePrivacyMode();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.code === "Quote") {
        e.preventDefault();
        triggerRefresh();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (e.key === "?") {
        setOpen((v) => !v);
        return;
      }

      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        triggerNewItem();
        return;
      }

      if (e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        triggerAddItem();
        return;
      }

      if (/^[1-8]$/.test(e.key)) {
        const item = navItems[Number(e.key) - 1];
        if (item) {
          router.push(item.href);
          setOpen(false);
        }
        return;
      }

      if (pendingGoTo.current) {
        pendingGoTo.current = false;
        if (e.key.toLowerCase() === "d") router.push("/");
        if (e.key.toLowerCase() === "a") router.push("/accounts");
        if (e.key.toLowerCase() === "g") router.push("/goals");
        if (e.key.toLowerCase() === "t") router.push("/stocks");
        if (e.key.toLowerCase() === "n") router.push("/analysis");
        if (e.key.toLowerCase() === "p") router.push("/projections");
        if (e.key.toLowerCase() === "h") router.push("/history");
        if (e.key.toLowerCase() === "s") router.push("/settings");
        setOpen(false);
        return;
      }

      if (e.key.toLowerCase() === "g") {
        pendingGoTo.current = true;
        if (goToTimeoutRef.current !== null) window.clearTimeout(goToTimeoutRef.current);
        goToTimeoutRef.current = window.setTimeout(() => {
          pendingGoTo.current = false;
          goToTimeoutRef.current = null;
        }, 900);
      }
    };

    const onOpen = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("command-palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("command-palette:open", onOpen);
      if (goToTimeoutRef.current !== null) window.clearTimeout(goToTimeoutRef.current);
    };
  }, [
    navItems,
    router,
    togglePrivacyMode,
    triggerRefresh,
    toggleSidebar,
    triggerNewItem,
    triggerAddItem,
  ]);

  const privacyShortcut = isMac ? "⌘;" : "Ctrl+;";
  const refreshShortcut = isMac ? "⌘'" : "Ctrl+'";
  const sidebarShortcut = isMac ? "⌘\\" : "Ctrl+\\";
  const paletteShortcut = isMac ? "⌘K" : "Ctrl+K";
  const goShortcut = t("commandPalette.goSequence");

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="top-[22%] translate-y-0">
      <CommandInput placeholder={t("commandPalette.placeholder")} />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>{t("commandPalette.noResults")}</CommandEmpty>
        <CommandGroup heading={t("commandPalette.groupShortcuts")}>
          <CommandItem value={`shortcut ${paletteShortcut} open command palette`}>
            {t("commandPalette.openPalette")}
            <CommandShortcut>{paletteShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem value="shortcut ? open shortcuts help">
            {t("commandPalette.openPalette")}
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem value={`shortcut 1 2 3 4 5 6 7 8 navigation`}>
            {t("commandPalette.navigateTabs")}
            <CommandShortcut>1-8</CommandShortcut>
          </CommandItem>
          <CommandItem value={`shortcut ${goShortcut} go to`}>
            {t("commandPalette.goToShortcut")}
            <CommandShortcut>{goShortcut}</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t("commandPalette.groupNavigation")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  router.push(item.href);
                  setOpen(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
                <CommandShortcut>{item.kbd}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading={t("commandPalette.groupActions")}>
          <CommandItem
            onSelect={() => {
              togglePrivacyMode();
              setOpen(false);
            }}
          >
            <Shield className="mr-2 h-4 w-4" />
            {t("commandPalette.togglePrivacy")}
            <CommandShortcut>{privacyShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleSidebar();
              setOpen(false);
            }}
          >
            <PanelLeftClose className="mr-2 h-4 w-4" />
            {t("commandPalette.toggleSidebar")}
            <CommandShortcut>{sidebarShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              triggerRefresh();
              setOpen(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("commandPalette.refreshPrices")}
            <CommandShortcut>{refreshShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              triggerNewItem();
              setOpen(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("commandPalette.createNew")}
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              triggerAddItem();
              setOpen(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("commandPalette.addItem")}
            <CommandShortcut>I</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("commandPalette.signOut")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
