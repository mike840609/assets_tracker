"use client";

import { useTheme } from "next-themes";
import { startTransition, useEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

type ThemeValue = (typeof themes)[number]["value"];
type ThemeToggleMode = "segmented" | "cycle";

type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

export function ThemeToggle({ mode = "segmented" }: { mode?: ThemeToggleMode }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const activeTheme: ThemeValue = themes.some(({ value }) => value === theme)
    ? (theme as ThemeValue)
    : "system";
  const activeIndex = themes.findIndex(({ value }) => value === activeTheme);
  const activeThemeItem = themes[activeIndex] ?? themes[2];
  const nextTheme = themes[(activeIndex + 1) % themes.length]?.value ?? "system";

  useEffect(() => startTransition(() => setMounted(true)), []);

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
        // Synchronous DOM commit so the View Transitions API captures the
        // before/after states correctly across the radial reveal.
        flushSync(() => setTheme(value));
      });

      transition.finished.finally(() => {
        root.removeAttribute("data-vt-theme");
      });
    },
    [theme, setTheme],
  );

  if (!mounted) {
    if (mode === "cycle") {
      return (
        <div className="inline-flex size-11 items-center justify-center rounded-lg bg-muted/50">
          <div className="h-4 w-4 rounded-sm bg-muted" />
        </div>
      );
    }

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

  if (mode === "cycle") {
    const Icon = activeThemeItem.icon;
    return (
      <button
        type="button"
        onClick={(e) => handleSelect(nextTheme, e)}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-lg text-sm transition-colors duration-200",
          "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        title={activeThemeItem.label}
        aria-label={`${activeThemeItem.label} theme. Tap to change theme.`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          type="button"
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
      ))}
    </div>
  );
}
