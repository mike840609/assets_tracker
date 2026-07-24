"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  CalendarDays,
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
  Sparkles,
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

interface DesktopCommandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
  onTogglePrivacy: () => void;
  onToggleSidebar: () => void;
  onRefreshPrices: () => void;
  onCreateNew: () => void;
  onAddItem: () => void;
}

export function DesktopCommandPaletteDialog({
  open,
  onOpenChange,
  onNavigate,
  onTogglePrivacy,
  onToggleSidebar,
  onRefreshPrices,
  onCreateNew,
  onAddItem,
}: DesktopCommandPaletteDialogProps) {
  const [isMac] = useState(
    () => typeof window !== "undefined" && navigator.userAgent.includes("Mac"),
  );
  const t = useTranslations();

  const navItems = useMemo(
    () => [
      { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, kbd: "1" },
      { href: "/accounts", label: t("nav.accounts"), icon: Copy, kbd: "2" },
      { href: "/goals", label: t("nav.goals"), icon: Target, kbd: "3" },
      { href: "/stocks", label: t("nav.stocks"), icon: ChartCandlestick, kbd: "4" },
      { href: "/analysis", label: t("nav.analysis"), icon: BarChart3, kbd: "5" },
      { href: "/projections", label: t("nav.projections"), icon: TrendingUp, kbd: "6" },
      { href: "/calendar", label: t("nav.calendar"), icon: CalendarDays, kbd: "7" },
      { href: "/history", label: t("nav.history"), icon: History, kbd: "8" },
      { href: "/settings", label: t("nav.settings"), icon: Settings, kbd: "9" },
    ],
    [t],
  );

  const privacyShortcut = isMac ? "⌘;" : "Ctrl+;";
  const refreshShortcut = isMac ? "⌘'" : "Ctrl+'";
  const sidebarShortcut = isMac ? "⌘\\" : "Ctrl+\\";
  const paletteShortcut = isMac ? "⌘K" : "Ctrl+K";
  const goShortcut = t("commandPalette.goSequence");

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} className="top-[22%] translate-y-0">
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
          <CommandItem value={`shortcut 1 2 3 4 5 6 7 8 9 navigation`}>
            {t("commandPalette.navigateTabs")}
            <CommandShortcut>1-9</CommandShortcut>
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
                  onNavigate(item.href);
                  onOpenChange(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
                <CommandShortcut>{item.kbd}</CommandShortcut>
              </CommandItem>
            );
          })}
          <CommandItem
            onSelect={() => {
              onNavigate("/changelog");
              onOpenChange(false);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {t("nav.changelog")}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t("commandPalette.groupActions")}>
          <CommandItem
            onSelect={() => {
              onTogglePrivacy();
              onOpenChange(false);
            }}
          >
            <Shield className="mr-2 h-4 w-4" />
            {t("commandPalette.togglePrivacy")}
            <CommandShortcut>{privacyShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onToggleSidebar();
              onOpenChange(false);
            }}
          >
            <PanelLeftClose className="mr-2 h-4 w-4" />
            {t("commandPalette.toggleSidebar")}
            <CommandShortcut>{sidebarShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onRefreshPrices();
              onOpenChange(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("commandPalette.refreshPrices")}
            <CommandShortcut>{refreshShortcut}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onCreateNew();
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("commandPalette.createNew")}
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onAddItem();
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("commandPalette.addItem")}
            <CommandShortcut>I</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
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
