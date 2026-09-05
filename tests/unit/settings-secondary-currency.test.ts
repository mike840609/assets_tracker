import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en-US",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/refresh-client", () => ({ refreshMarketData: vi.fn() }));
vi.mock("@/hooks/use-refresh-cooldown", () => ({
  useRefreshCooldown: () => ({ coolingDown: false, secondsLeft: 0 }),
}));
vi.mock("@/components/layout/density-context", () => ({
  useDensity: () => ({ density: "comfortable", isReady: true, setDensity: vi.fn() }),
}));
vi.mock("@/components/layout/color-schema-context", () => ({
  useColorSchema: () => ({ colorSchema: "emerald", isReady: true, setColorSchema: vi.fn() }),
}));
vi.mock("@/components/layout/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/ui/freshness-badge", () => ({ FreshnessBadge: () => null }));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) =>
    createElement("button", props, children),
}));
vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement("div", null, children) : null,
  CommandEmpty: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CommandGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CommandInput: () => null,
  CommandItem: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CommandList: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectItem: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectTrigger: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) =>
    createElement("button", props, children),
  SelectValue: ({ children }: { children: ReactNode }) => createElement("span", null, children),
}));

import { SettingsForm } from "@/components/settings/settings-form";

function renderSettings(currentSecondaryCurrency: string | null = null) {
  return renderToStaticMarkup(
    createElement(SettingsForm, {
      currentCurrency: "USD",
      currentSecondaryCurrency,
      currentLocale: "en-US",
    }),
  );
}

describe("secondary currency selector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an off state in the selector instead of a separate switch", () => {
    const html = renderSettings();

    expect(html).toContain("secondaryCurrencyOff");
    expect(html).not.toContain('role="switch"');
  });

  it("shows the selected currency in the same selector without a switch", () => {
    const html = renderSettings("JPY");

    expect(html).toContain("JPY — Japanese Yen (¥)");
    expect(html).not.toContain('role="switch"');
  });
});
