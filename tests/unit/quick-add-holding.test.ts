import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: unknown }) => children,
  DialogContent: ({ children }: { children: unknown }) => children,
  DialogHeader: ({ children }: { children: unknown }) => children,
  DialogTitle: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: unknown }) => children,
  DrawerContent: ({ children }: { children: unknown }) => children,
  DrawerHeader: ({ children }: { children: unknown }) => children,
  DrawerTitle: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/input", () => ({
  Input: () => null,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: unknown }) => children,
  TabsList: ({ children }: { children: unknown }) => children,
  TabsTrigger: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: unknown }) => children,
  SelectContent: ({ children }: { children: unknown }) => children,
  SelectItem: ({ children }: { children: unknown }) => children,
  SelectTrigger: ({ children }: { children: unknown }) => children,
  SelectValue: ({ children }: { children: unknown }) => children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-discard-guard", () => ({
  useDiscardGuard: () => ({
    confirmOpen: false,
    setConfirmOpen: vi.fn(),
    requestClose: vi.fn(),
    confirmDiscard: vi.fn(),
  }),
}));

vi.mock("@/components/discard-confirm-dialog", () => ({
  DiscardConfirmDialog: () => null,
}));

vi.mock("./holding-search", async () => {
  const actual = await import("@/components/accounts/holding-search");
  return {
    ...actual,
    HoldingSearch: () => null,
  };
});

describe("parseQuickAddUnitPrice", () => {
  let parseQuickAddUnitPrice: typeof import("@/components/accounts/quick-add-holding").parseQuickAddUnitPrice;

  beforeEach(async () => {
    ({ parseQuickAddUnitPrice } = await import("@/components/accounts/quick-add-holding"));
  });

  it("treats an empty input as omitted", () => {
    expect(parseQuickAddUnitPrice("")).toEqual({ value: undefined });
    expect(parseQuickAddUnitPrice("   ")).toEqual({ value: undefined });
  });

  it("parses a positive masked amount", () => {
    expect(parseQuickAddUnitPrice("1,234.5")).toEqual({ value: 1234.5 });
  });

  it("rejects zero, negative, and invalid values", () => {
    expect(parseQuickAddUnitPrice("0")).toEqual({ error: "invalid" });
    expect(parseQuickAddUnitPrice("-1")).toEqual({ error: "invalid" });
    expect(parseQuickAddUnitPrice("abc")).toEqual({ error: "invalid" });
  });
});
