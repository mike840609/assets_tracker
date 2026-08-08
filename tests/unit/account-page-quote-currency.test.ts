import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SerializedAccountWithHoldings } from "@/lib/types";
import type { AccountPriceMap } from "@/lib/services/account-service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { defaultValue?: string }) =>
    values?.defaultValue ?? key,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({ children }: { children: React.ReactNode }) =>
          React.createElement(tag, null, children),
    },
  ),
  Reorder: {
    Group: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    Item: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
  },
  useDragControls: () => ({ start: vi.fn() }),
  useMotionValue: (value: number) => ({ get: () => value }),
  useReducedMotion: () => true,
  useTransform: () => 1,
  animate: vi.fn(),
}));

vi.mock("@/components/layout/privacy-mode-context", () => ({
  usePrivacyMode: () => ({ privacyMode: false }),
}));

vi.mock("@/components/layout/density-context", () => ({
  useDensity: () => ({ density: "comfortable" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/undo-delete", () => ({
  showUndoDeleteToast: vi.fn(),
}));

const account: SerializedAccountWithHoldings = {
  id: "account-usd",
  userId: "user-1",
  name: "Crypto wallet",
  type: "ASSET",
  category: "CRYPTO_WALLET",
  currency: "USD",
  cashBalance: 0,
  isActive: true,
  isPinned: false,
  sortOrder: 0,
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
  holdings: [
    {
      id: "holding-btc",
      accountId: "account-usd",
      symbol: "BTC-EUR",
      name: "Bitcoin",
      quantity: 1,
      currency: "USD",
      assetType: "CRYPTO",
      underlyingSymbol: null,
      optionType: null,
      strike: null,
      expiration: null,
      contractMultiplier: null,
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
  ],
};

const quotedInEuros: AccountPriceMap = {
  "BTC-EUR": { price: 50_000, currency: "EUR" },
};
const euroToUsd = { EUR_USD: 1.1 };

describe("account pages use the cached quote currency", () => {
  it("renders the accounts-list value in account currency", async () => {
    const { AccountsList } = await import("@/components/accounts/accounts-list");

    const html = renderToStaticMarkup(
      React.createElement(AccountsList, {
        accounts: [account],
        archivedAccounts: [],
        priceMap: quotedInEuros,
        ratesMap: euroToUsd,
        baseCurrency: "USD",
      }),
    );

    expect(html).toContain("$55,000");
    expect(html).not.toContain("$50,000");
  });

  it("renders detail market value in account currency and raw quotes in quote currency", async () => {
    const { AccountDetail } = await import("@/components/accounts/account-detail");

    const html = renderToStaticMarkup(
      React.createElement(AccountDetail, {
        account,
        priceMap: quotedInEuros,
        ratesMap: euroToUsd,
      }),
    );

    expect(html).toContain("$55,000");
    expect(html.match(/€50,000/g)).toHaveLength(2);
    expect(html).not.toContain("$50,000");
  });

  it("falls back to the holding currency when a cached quote has no currency", async () => {
    const { AccountsList } = await import("@/components/accounts/accounts-list");

    const html = renderToStaticMarkup(
      React.createElement(AccountsList, {
        accounts: [account],
        archivedAccounts: [],
        priceMap: { "BTC-EUR": { price: 50_000 } },
        ratesMap: euroToUsd,
        baseCurrency: "USD",
      }),
    );

    expect(html).toContain("$50,000");
    expect(html).not.toContain("$55,000");
  });

  it("keeps non-investment account cash independent of cached quotes", async () => {
    const { AccountsList } = await import("@/components/accounts/accounts-list");
    const bankAccount: SerializedAccountWithHoldings = {
      ...account,
      id: "account-bank",
      name: "Checking",
      category: "BANK",
      cashBalance: 1_234,
      holdings: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(AccountsList, {
        accounts: [bankAccount],
        archivedAccounts: [],
        priceMap: {},
        ratesMap: euroToUsd,
        baseCurrency: "USD",
      }),
    );

    expect(html).toContain("$1,234");
  });

  it("keeps detail cash value when a holding has no cached quote", async () => {
    const { AccountDetail } = await import("@/components/accounts/account-detail");
    const accountWithCash: SerializedAccountWithHoldings = {
      ...account,
      cashBalance: 123,
    };

    const html = renderToStaticMarkup(
      React.createElement(AccountDetail, {
        account: accountWithCash,
        priceMap: {},
        ratesMap: euroToUsd,
      }),
    );

    expect(html).toContain("$123");
    expect(html).not.toContain("$50,000");
  });

  it("shows the paused Demo explanation while keeping recurring rule actions available", async () => {
    const { AccountDetail } = await import("@/components/accounts/account-detail");

    const html = renderToStaticMarkup(
      React.createElement(AccountDetail, {
        account,
        priceMap: quotedInEuros,
        ratesMap: euroToUsd,
        isDemo: true,
      }),
    );

    expect(html).toContain("demoPausedTitle");
    expect(html).toContain("demoPausedDescription");
    expect(html.match(/>add</g)).toHaveLength(2);
  });
});
