import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en-US",
}));
const privacy = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/components/layout/privacy-mode-context", () => ({
  usePrivacyMode: () => ({ privacyMode: privacy.enabled }),
}));
vi.mock("@/components/layout/density-context", () => ({
  useDensity: () => ({ density: "comfortable" }),
}));

import { NetWorthCard } from "@/components/dashboard/net-worth-card";

const summary = {
  totalAssets: 100,
  totalLiabilities: 20,
  netWorth: 80,
  baseCurrency: "USD",
  currencyExposure: [],
  accounts: [{ type: "ASSET", id: "a" }],
} as never;

describe("NetWorthCard secondary currency", () => {
  beforeEach(() => {
    privacy.enabled = false;
  });

  it("renders all three totals in the selected secondary currency", () => {
    const html = renderToStaticMarkup(
      createElement(NetWorthCard, { summary, secondaryCurrency: "JPY", secondaryRate: 150 }),
    );

    expect(html).toContain("¥12,000");
    expect(html).toContain("¥15,000");
    expect(html).toContain("¥3,000");
  });

  it("renders no secondary totals when disabled", () => {
    const html = renderToStaticMarkup(createElement(NetWorthCard, { summary }));

    expect(html).not.toContain("¥");
  });

  it("labels unavailable secondary rates without inventing a total", () => {
    const html = renderToStaticMarkup(
      createElement(NetWorthCard, { summary, secondaryCurrency: "JPY" }),
    );

    expect(html.match(/— JPY/g)).toHaveLength(3);
  });

  it("masks secondary totals in privacy mode", () => {
    privacy.enabled = true;
    const html = renderToStaticMarkup(
      createElement(NetWorthCard, { summary, secondaryCurrency: "JPY", secondaryRate: 150 }),
    );

    expect(html.match(/\*\*\*/g)).toHaveLength(6);
    expect(html).not.toContain("¥");
  });
});
