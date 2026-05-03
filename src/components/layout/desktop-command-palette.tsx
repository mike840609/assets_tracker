"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, Copy, History, LayoutDashboard, RefreshCw, Settings, Shield } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { usePrivacyMode } from "./privacy-mode-context";

export function DesktopCommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
    const t = useTranslations();
  const { togglePrivacyMode } = usePrivacyMode();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if ((e.target as HTMLElement | null)?.closest("input,textarea,[contenteditable=true]")) return;
      if (e.key === "1") router.push("/");
      if (e.key === "2") router.push("/accounts");
      if (e.key === "3") router.push("/analysis");
      if (e.key === "4") router.push("/history");
      if (e.key === "5") router.push("/settings");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);


  const navItems = useMemo(() => ([
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, kbd: "1" },
    { href: "/accounts", label: t("nav.accounts"), icon: Copy, kbd: "2" },
    { href: "/analysis", label: t("nav.analysis"), icon: BarChart3, kbd: "3" },
    { href: "/history", label: t("nav.history"), icon: History, kbd: "4" },
    { href: "/settings", label: t("nav.settings"), icon: Settings, kbd: "5" },
  ]), [t]);

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
          <CommandItem onSelect={() => { togglePrivacyMode(); setOpen(false); }}>
            <Shield className="mr-2 h-4 w-4" />
            Toggle privacy mode
            <CommandShortcut>⌘⇧P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { window.dispatchEvent(new CustomEvent("prices:refresh")); setOpen(false); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh prices
            <CommandShortcut>⌘R</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
