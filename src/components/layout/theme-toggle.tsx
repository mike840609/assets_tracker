"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

type ThemeValue = (typeof themes)[number]["value"];

type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

const CYCLE_ORDER: ThemeValue[] = ["light", "dark", "system"];

export function ThemeToggle({
  variant = "compact",
}: {
  variant?: "compact" | "full" | "cycle" | "popover";
}) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("common.theme");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => startTransition(() => setMounted(true)), []);

  useEffect(() => {
    if (variant !== "popover" || !open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [variant, open]);

  const handleSelect = useCallback(
    (value: ThemeValue, event: React.MouseEvent<HTMLButtonElement>) => {
      if (value === theme) return;

      const doc = document as DocumentWithVT;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!doc.startViewTransition || reduceMotion) {
        startTransition(() => setTheme(value));
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const root = document.documentElement;
      root.style.setProperty("--vt-theme-x", `${x}px`);
      root.style.setProperty("--vt-theme-y", `${y}px`);
      root.setAttribute("data-vt-theme", "1");

      const transition = doc.startViewTransition(() => {
        flushSync(() => setTheme(value));
      });

      transition.finished.finally(() => {
        root.removeAttribute("data-vt-theme");
      });
    },
    [theme, setTheme],
  );

  if (variant === "popover") {
    const CurrentIcon = mounted
      ? (themes.find((t) => t.value === theme)?.icon ?? Monitor)
      : Monitor;
    const changeTheme = t("change");

    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={changeTheme}
          title={changeTheme}
          className="inline-flex items-center justify-center rounded-md h-11 w-11 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <CurrentIcon className="h-4 w-4" />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={t("label")}
            className="absolute top-full right-0 mt-1 z-[60] w-36 rounded-xl border border-border bg-popover shadow-lg shadow-black/10 dark:shadow-black/30 overflow-hidden"
          >
            {themes.map(({ value, icon: Icon }) => {
              const label = t(value);
              const isActive = mounted && theme === value;
              return (
                <button
                  key={value}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onClick={(e) => {
                    handleSelect(value, e);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className="flex w-full items-center gap-1 rounded-lg border p-1 bg-muted/30 sm:w-fit">
        {themes.map(({ value, icon: Icon }) => {
          const label = t(value);
          const isActive = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={(e) => handleSelect(value, e)}
              title={label}
              aria-pressed={isActive}
              className={cn(
                "flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-none md:min-h-0",
                isActive
                  ? "bg-background border border-border shadow-sm text-foreground font-semibold"
                  : "border border-transparent text-muted-foreground font-medium hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "cycle") {
    const currentIndex = CYCLE_ORDER.indexOf((theme as ThemeValue) ?? "system");
    const nextTheme = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
    const nextEntry = themes.find((t) => t.value === nextTheme)!;
    const nextLabel = t(nextEntry.value);
    const CurrentIcon = mounted
      ? (themes.find((t) => t.value === theme)?.icon ?? Monitor)
      : Monitor;

    return (
      <button
        type="button"
        onClick={(e) => handleSelect(nextTheme, e)}
        aria-label={t("switchTo", { theme: nextLabel })}
        title={t("switchTo", { theme: nextLabel })}
        className="inline-flex items-center justify-center rounded-md h-11 w-11 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
    );
  }

  if (!mounted) {
    return (
      <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
        {themes.map(({ value }) => (
          <div key={value} className="inline-flex items-center justify-center rounded-md p-1.5">
            <div className="h-4 w-4 rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
      {themes.map(({ value, icon: Icon }) => {
        const label = t(value);
        return (
          <button
            key={value}
            onClick={(e) => handleSelect(value, e)}
            className={cn(
              "inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-all duration-200",
              theme === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
