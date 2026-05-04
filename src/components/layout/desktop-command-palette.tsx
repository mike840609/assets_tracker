"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, Copy, History, LayoutDashboard, RefreshCw, Settings, Shield } from "lucide-react";
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
  const router = useRouter();
  const t = useTranslations();
  const { togglePrivacyMode } = usePrivacyMode();
  const pendingGoTo = useRef(false);
  const goToTimeoutRef = useRef<number | null>(null);

  const navItems = useMemo(
    () => [
      { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, kbd: "1" },
      { href: "/accounts", label: t("nav.accounts"), icon: Copy, kbd: "2" },
      { href: "/analysis", label: t("nav.analysis"), icon: BarChart3, kbd: "3" },
      { href: "/history", label: t("nav.history"), icon: History, kbd: "4" },
      { href: "/settings", label: t("nav.settings"), icon: Settings, kbd: "5" },
    ],
    [t],
  );

  const triggerRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent("prices:refresh"));
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

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePrivacyMode();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        triggerRefresh();
        return;
      }

      if (/^[1-5]$/.test(e.key)) {
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
        if (e.key.toLowerCase() === "h") router.push("/history");
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

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (goToTimeoutRef.current !== null) window.clearTimeout(goToTimeoutRef.current);
    };
  }, [navItems, router, togglePrivacyMode, triggerRefresh]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} onSelect={() => router.push(item.href)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
                <CommandShortcut>{item.kbd}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              togglePrivacyMode();
              setOpen(false);
            }}
          >
            <Shield className="mr-2 h-4 w-4" />
            Toggle privacy mode
            <CommandShortcut>⌘⇧P</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              triggerRefresh();
              setOpen(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh prices
            <CommandShortcut>⌘⇧R</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
