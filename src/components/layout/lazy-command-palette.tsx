"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePrivacyMode } from "./privacy-mode-context";

const DesktopCommandPaletteDialog = dynamic(
  () =>
    import("@/components/layout/desktop-command-palette").then(
      (m) => m.DesktopCommandPaletteDialog,
    ),
  { ssr: false },
);

const NAV_HREFS = [
  "/",
  "/accounts",
  "/goals",
  "/stocks",
  "/analysis",
  "/projections",
  "/calendar",
  "/history",
  "/settings",
] as const;

export function LazyCommandPalette() {
  const router = useRouter();
  const { togglePrivacyMode } = usePrivacyMode();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pendingGoTo = useRef(false);
  const goToTimeoutRef = useRef<number | null>(null);

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
  const navigateTo = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  useEffect(() => {
    const clearGoTo = () => {
      pendingGoTo.current = false;
      if (goToTimeoutRef.current !== null) {
        window.clearTimeout(goToTimeoutRef.current);
        goToTimeoutRef.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,[contenteditable=true]")) return;
      const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (pendingGoTo.current && hasModifier) clearGoTo();

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.code === "Semicolon") {
        event.preventDefault();
        togglePrivacyMode();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.code === "Quote") {
        event.preventDefault();
        triggerRefresh();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      if (event.key === "?") {
        setOpen((value) => !value);
        return;
      }

      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        triggerNewItem();
        return;
      }

      if (
        event.key.toLowerCase() === "i" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        triggerAddItem();
        return;
      }

      if (!hasModifier && /^[1-9]$/.test(event.key)) {
        const href = NAV_HREFS[Number(event.key) - 1];
        if (href) {
          navigateTo(href);
          setOpen(false);
        }
        return;
      }

      if (pendingGoTo.current) {
        clearGoTo();
        const key = event.key.toLowerCase();
        const href =
          key === "d"
            ? "/"
            : key === "a"
              ? "/accounts"
              : key === "g"
                ? "/goals"
                : key === "t"
                  ? "/stocks"
                  : key === "n"
                    ? "/analysis"
                    : key === "p"
                      ? "/projections"
                      : key === "c"
                        ? "/calendar"
                        : key === "h"
                          ? "/history"
                          : key === "s"
                            ? "/settings"
                            : null;
        if (href) {
          navigateTo(href);
          setOpen(false);
        }
        return;
      }

      if (!hasModifier && event.key.toLowerCase() === "g") {
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
      clearGoTo();
    };
  }, [
    navigateTo,
    togglePrivacyMode,
    triggerAddItem,
    triggerNewItem,
    triggerRefresh,
    toggleSidebar,
  ]);

  return open ? (
    <DesktopCommandPaletteDialog
      open={open}
      onOpenChange={setOpen}
      onNavigate={navigateTo}
      onTogglePrivacy={togglePrivacyMode}
      onToggleSidebar={toggleSidebar}
      onRefreshPrices={triggerRefresh}
      onCreateNew={triggerNewItem}
      onAddItem={triggerAddItem}
    />
  ) : null;
}
