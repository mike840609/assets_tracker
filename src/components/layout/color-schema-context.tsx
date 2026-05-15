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

interface ColorSchemaContextType {
  colorSchema: ColorSchema;
  setColorSchema: (schema: ColorSchema) => void;
}

const ColorSchemaContext = createContext<ColorSchemaContextType>({
  colorSchema: "emerald",
  setColorSchema: () => {},
});

const STORAGE_KEY = "asset-tracker:color-schema";

function applySchema(schema: ColorSchema) {
  if (schema === "emerald") {
    delete document.documentElement.dataset.colorSchema;
  } else {
    document.documentElement.dataset.colorSchema = schema;
  }
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
