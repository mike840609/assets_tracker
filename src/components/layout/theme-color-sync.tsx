"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

// Approximate hex equivalents of the CSS oklch() background tokens.
const LIGHT_COLOR = "#f8f9ff"; // oklch(0.99 0.003 260)
const DARK_COLOR = "#0e1f24"; // oklch(0.14 0.030 200)

// Updates the first <meta name="theme-color"> tag whenever the user explicitly
// toggles the in-app theme (light / dark / system). The Next.js viewport export
// already seeds two media-query tags for SSR / system-preference; this component
// corrects whichever tag is active after client-side hydration.
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === "dark" ? DARK_COLOR : LIGHT_COLOR;
    // Update all theme-color meta tags so both light/dark media variants reflect
    // the user's explicit preference.
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((el) => {
        el.content = color;
      });
  }, [resolvedTheme]);

  return null;
}
