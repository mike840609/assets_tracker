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

export type ColorSchema = "emerald" | "anthropic" | "ocean" | "violet" | "amber" | "rose";

const VALID_SCHEMAS: ColorSchema[] = ["emerald", "anthropic", "ocean", "violet", "amber", "rose"];

const ICON_PALETTES: Record<ColorSchema, { start: string; end: string }> = {
  emerald: { start: "#34d399", end: "#065f46" },
  anthropic: { start: "#e8916e", end: "#9a3412" },
  ocean: { start: "#60a5fa", end: "#075985" },
  violet: { start: "#a78bfa", end: "#5b21b6" },
  amber: { start: "#fbbf24", end: "#92400e" },
  rose: { start: "#fb7185", end: "#9f1239" },
};

interface ColorSchemaContextType {
  colorSchema: ColorSchema;
  setColorSchema: (schema: ColorSchema) => void;
}

const ColorSchemaContext = createContext<ColorSchemaContextType>({
  colorSchema: "emerald",
  setColorSchema: () => {},
});

const STORAGE_KEY = "asset-tracker:color-schema";

function createFaviconHref(schema: ColorSchema) {
  const palette = ICON_PALETTES[schema];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.start}"/><stop offset="100%" stop-color="${palette.end}"/></linearGradient></defs><rect width="32" height="32" rx="6" fill="url(#g)"/><path d="M8 20 L13.5 13.5 L17.5 17.5 L24 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 10 L24 10 L24 14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyFavicon(schema: ColorSchema) {
  const href = createFaviconHref(schema);
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
  applyFavicon(schema);
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
    () => ({ colorSchema: mounted ? colorSchema : "emerald", setColorSchema }),
    [mounted, colorSchema, setColorSchema],
  );

  return <ColorSchemaContext.Provider value={value}>{children}</ColorSchemaContext.Provider>;
}

export function useColorSchema() {
  return useContext(ColorSchemaContext);
}
