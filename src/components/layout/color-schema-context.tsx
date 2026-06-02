"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";
import {
  APP_ICON_FALLBACK_END,
  APP_ICON_FALLBACK_START,
  APP_ICON_FAVICON_RADIUS,
  createAppIconSvg,
} from "./app-icon";

export type ColorSchema = "emerald" | "anthropic" | "ocean" | "violet" | "amber" | "rose";

const VALID_SCHEMAS: ColorSchema[] = ["emerald", "anthropic", "ocean", "violet", "amber", "rose"];

interface ColorSchemaContextType {
  colorSchema: ColorSchema;
  isReady: boolean;
  setColorSchema: (schema: ColorSchema) => void;
}

const ColorSchemaContext = createContext<ColorSchemaContextType>({
  colorSchema: "emerald",
  isReady: false,
  setColorSchema: () => {},
});

const STORAGE_KEY = "asset-tracker:color-schema";

function getAppIconPalette() {
  const styles = getComputedStyle(document.documentElement);

  return {
    start: styles.getPropertyValue("--app-icon-gradient-start").trim() || APP_ICON_FALLBACK_START,
    end: styles.getPropertyValue("--app-icon-gradient-end").trim() || APP_ICON_FALLBACK_END,
  };
}

function createFaviconHref() {
  const palette = getAppIconPalette();
  const svg = createAppIconSvg({
    ...palette,
    radius: APP_ICON_FAVICON_RADIUS,
  });

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyFavicon() {
  const href = createFaviconHref();
  const existing = document.querySelector<HTMLLinkElement>(
    'link[data-color-schema-favicon="true"]',
  );
  const link = existing ?? document.createElement("link");

  link.dataset.colorSchemaFavicon = "true";
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.sizes = "any";
  link.href = href;

  if (!existing) {
    document.head.appendChild(link);
  }
}

function applySchema(schema: ColorSchema) {
  if (schema === "emerald") {
    delete document.documentElement.dataset.colorSchema;
  } else {
    document.documentElement.dataset.colorSchema = schema;
  }
  applyFavicon();
}

export function ColorSchemaProvider({ children }: { children: React.ReactNode }) {
  const [colorSchema, setColorSchemaState] = useState<ColorSchema>("emerald");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorSchema | null;
    const schema = stored && VALID_SCHEMAS.includes(stored) ? stored : "emerald";
    applySchema(schema);
    startTransition(() => {
      setMounted(true);
      setColorSchemaState(schema);
    });
  }, []);

  const setColorSchema = useCallback((next: ColorSchema) => {
    localStorage.setItem(STORAGE_KEY, next);
    applySchema(next);
    startTransition(() => setColorSchemaState(next));
  }, []);

  const value = useMemo(
    () => ({ colorSchema: mounted ? colorSchema : "emerald", isReady: mounted, setColorSchema }),
    [mounted, colorSchema, setColorSchema],
  );

  return <ColorSchemaContext.Provider value={value}>{children}</ColorSchemaContext.Provider>;
}

export function useColorSchema() {
  return useContext(ColorSchemaContext);
}
