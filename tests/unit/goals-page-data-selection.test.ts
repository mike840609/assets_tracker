import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOrCreateSettings: vi.fn(),
  computeGoalsWithProgress: vi.fn(),
  fetchUserAccountsWithHoldings: vi.fn(),
  getProjectionData: vi.fn(),
  getCachedTrackedStocks: vi.fn(),
  getCalendarEntriesInRange: vi.fn(),
  getCalendarEarnings: vi.fn(),
  getTranslations: vi.fn(),
  getMessages: vi.fn(),
  getLocale: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => ({ getSession: h.getSession }));
vi.mock("@/lib/services/settings-service", () => ({
  getOrCreateSettings: h.getOrCreateSettings,
}));
vi.mock("@/lib/services/goal-service", () => ({
  computeGoalsWithProgress: h.computeGoalsWithProgress,
}));
vi.mock("@/lib/services/net-worth-service", () => ({
  fetchUserAccountsWithHoldings: h.fetchUserAccountsWithHoldings,
}));
vi.mock("@/lib/services/projection-service", () => ({ getProjectionData: h.getProjectionData }));
vi.mock("@/lib/services/stock-watch-service", () => ({
  getCachedTrackedStocks: h.getCachedTrackedStocks,
}));
vi.mock("@/lib/services/calendar-entry-service", () => ({
  getCalendarEntriesInRange: h.getCalendarEntriesInRange,
}));
vi.mock("@/lib/services/calendar-earnings-data", () => ({
  CALENDAR_EARNINGS_RATE_LIMIT: 1,
  getCalendarEarnings: h.getCalendarEarnings,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitSubjectCheckWithPrune: () => false }));
vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next-intl/server", () => ({
  getTranslations: h.getTranslations,
  getMessages: h.getMessages,
  getLocale: h.getLocale,
}));
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/lib/i18n-utils", () => ({ pickMessages: (messages: unknown) => messages }));
vi.mock("@/components/layout/large-title-heading", () => ({
  LargeTitleHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/components/goals/goals-view", () => ({ GoalsView: () => null }));

import { GoalsContent } from "@/app/(main)/goals/page";

const mobileUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile";

function setDefaultMocks() {
  h.getSession.mockResolvedValue({ user: { id: "user-1" } });
  h.getOrCreateSettings.mockResolvedValue({ baseCurrency: "USD" });
  h.computeGoalsWithProgress.mockResolvedValue([]);
  h.fetchUserAccountsWithHoldings.mockResolvedValue([]);
  h.getProjectionData.mockResolvedValue({
    latestNetWorth: 0,
    trailing12mSavings: 0,
    annualSnapshots: [],
    hasData: false,
  });
  h.getCachedTrackedStocks.mockResolvedValue([]);
  h.getCalendarEntriesInRange.mockResolvedValue([]);
  h.getCalendarEarnings.mockResolvedValue([]);
  h.getTranslations.mockResolvedValue(() => "translated");
  h.getMessages.mockResolvedValue({});
  h.getLocale.mockResolvedValue("en-US");
  h.headers.mockResolvedValue(new Headers({ "user-agent": mobileUserAgent }));
}

async function load(tab: string, userAgent = mobileUserAgent) {
  h.headers.mockResolvedValue(new Headers({ "user-agent": userAgent }));
  await GoalsContent({ searchParams: Promise.resolve({ tab }) });
}

describe("Goals mobile panel data selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it.each([
    ["watchlist", "getCachedTrackedStocks"],
    ["goals", "computeGoalsWithProgress"],
    ["projections", "getProjectionData"],
    ["calendar", "getCalendarEntriesInRange"],
  ] as const)("reads only the %s panel services", async (tab, activeReader) => {
    await load(tab);

    for (const reader of [
      "getCachedTrackedStocks",
      "computeGoalsWithProgress",
      "fetchUserAccountsWithHoldings",
      "getProjectionData",
      "getCalendarEntriesInRange",
      "getCalendarEarnings",
    ] as const) {
      const expectedCalls =
        reader === activeReader ||
        (tab === "goals" && reader === "fetchUserAccountsWithHoldings") ||
        (tab === "calendar" && reader === "getCalendarEarnings")
          ? 1
          : 0;
      expect(h[reader]).toHaveBeenCalledTimes(expectedCalls);
    }
  });

  it("ignores the mobile tab query for a desktop user agent", async () => {
    await load("projections", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

    expect(h.computeGoalsWithProgress).toHaveBeenCalledOnce();
    expect(h.fetchUserAccountsWithHoldings).toHaveBeenCalledOnce();
    expect(h.getProjectionData).not.toHaveBeenCalled();
    expect(h.getCachedTrackedStocks).not.toHaveBeenCalled();
    expect(h.getCalendarEntriesInRange).not.toHaveBeenCalled();
    expect(h.getCalendarEarnings).not.toHaveBeenCalled();
  });

  it("starts the selected reader while translations are still pending", async () => {
    const resolvers: Array<(value: () => string) => void> = [];
    h.getTranslations.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

    const page = load("watchlist");
    await vi.waitFor(() => expect(h.getCachedTrackedStocks).toHaveBeenCalledOnce());
    expect(h.getMessages).toHaveBeenCalledOnce();

    for (const resolve of resolvers) resolve(() => "translated");
    await page;
  });
});
