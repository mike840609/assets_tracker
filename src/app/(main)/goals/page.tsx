import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { computeGoalsWithProgress } from "@/lib/services/goal-service";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import { getProjectionData } from "@/lib/services/projection-service";
import { getCachedTrackedStocks } from "@/lib/services/stock-watch-service";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { GoalsView } from "@/components/goals/goals-view";
import { taiwanCalendarDay } from "@/lib/app-day";
import {
  formatDateOnly,
  getVisibleCalendarRange,
  normalizeCalendarUrlState,
  parseDateOnly,
} from "@/lib/calendar-date";
import { getCalendarEntriesInRange } from "@/lib/services/calendar-entry-service";
import {
  CALENDAR_EARNINGS_RATE_LIMIT,
  getCalendarEarnings,
  type CalendarEarningsItem,
} from "@/lib/services/calendar-earnings-data";
import { rateLimitSubjectCheckWithPrune } from "@/lib/rate-limit";
import { isMobileUserAgent } from "@/lib/mobile-hub-route";
import { parseMobilePlanTab, type MobilePlanTab } from "@/components/goals/mobile-plan-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GoalWithProgress, SerializedAccount, SerializedCalendarEntry } from "@/lib/types";
import type { ProjectionData } from "@/lib/services/projection-service";
import type { SerializedTrackedStock } from "@/lib/services/stock-watch-service";

const CLIENT_NAMESPACES = [
  "goals",
  "common",
  "nav",
  "projections",
  "stocks",
  "holdingSearch",
  "freshness",
  "toast",
  "categories",
  "calendar",
];

type GoalsPageProps = {
  searchParams: Promise<{ month?: string; date?: string; tab?: string }>;
};

function PanelSkeleton() {
  return (
    <Card className="h-[300px]">
      <CardContent className="flex h-full flex-col gap-3 pt-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full max-w-xs" />
        <div className="mt-auto grid gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

type GoalsViewEagerProps = {
  goalsWithProgress?: GoalWithProgress[];
  baseCurrency: string;
  accounts?: SerializedAccount[];
  calendarMonth: string;
  calendarSelectedDate: string;
  calendarToday: string;
  locale: string;
};

type GoalsPanelData = {
  projectionData?: ProjectionData;
  stocks?: SerializedTrackedStock[];
  calendarEntries?: SerializedCalendarEntry[];
  calendarEarnings?: CalendarEarningsItem[];
};

function getGoalsPanelData({
  userId,
  isMobile,
  activeTab,
  baseCurrency,
  calendarMonth,
}: {
  userId: string;
  isMobile: boolean;
  activeTab: MobilePlanTab;
  baseCurrency: string;
  calendarMonth: string;
}): Promise<GoalsPanelData> {
  if (isMobile && activeTab === "goals") return Promise.resolve({});
  if (isMobile && activeTab === "watchlist") {
    return getCachedTrackedStocks(userId).then((stocks) => ({ stocks }));
  }
  if (isMobile && activeTab === "projections") {
    return getProjectionData(userId, baseCurrency).then((projectionData) => ({ projectionData }));
  }

  const { from, to } = getVisibleCalendarRange(calendarMonth);
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (!fromDate || !toDate) {
    throw new Error(`Invalid visible calendar range: ${from}..${to}`);
  }

  const earningsLimited = rateLimitSubjectCheckWithPrune(
    userId,
    "yahoo",
    CALENDAR_EARNINGS_RATE_LIMIT,
  );
  if (isMobile) {
    return Promise.all([
      getCalendarEntriesInRange(userId, fromDate, toDate),
      earningsLimited
        ? Promise.resolve<CalendarEarningsItem[]>([])
        : getCalendarEarnings(userId, from, to),
    ]).then(([calendarEntries, calendarEarnings]) => ({ calendarEntries, calendarEarnings }));
  }

  return Promise.all([
    getProjectionData(userId, baseCurrency),
    getCachedTrackedStocks(userId),
    getCalendarEntriesInRange(userId, fromDate, toDate),
    earningsLimited
      ? Promise.resolve<CalendarEarningsItem[]>([])
      : getCalendarEarnings(userId, from, to),
  ]).then(([projectionData, stocks, calendarEntries, calendarEarnings]) => ({
    projectionData,
    stocks,
    calendarEntries,
    calendarEarnings,
  }));
}

async function GoalsDeferredData({
  activeTab,
  requestedTab,
  eagerProps,
  panelDataP,
}: {
  activeTab: MobilePlanTab;
  requestedTab?: MobilePlanTab;
  eagerProps: GoalsViewEagerProps;
  panelDataP: Promise<GoalsPanelData>;
}) {
  const panelData = await panelDataP;

  const earningsByDate = new Map<string, CalendarEarningsItem[]>();
  for (const item of panelData.calendarEarnings ?? []) {
    const day = earningsByDate.get(item.date) ?? [];
    day.push(item);
    earningsByDate.set(item.date, day);
  }

  return (
    <GoalsView
      {...eagerProps}
      loadedTab={activeTab}
      requestedTab={requestedTab}
      projectionData={panelData.projectionData}
      stocks={panelData.stocks}
      calendarEntries={panelData.calendarEntries}
      earningsByDate={earningsByDate}
    />
  );
}

export async function GoalsContent({ searchParams }: GoalsPageProps) {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [{ tab, ...calendarSearchParams }, requestHeaders] = await Promise.all([
    searchParams,
    headers(),
  ]);
  const { month, date } = normalizeCalendarUrlState(calendarSearchParams);
  const isMobile = isMobileUserAgent(requestHeaders.get("user-agent"));
  const requestedTab = isMobile && tab !== undefined ? parseMobilePlanTab(tab) : undefined;
  const activeTab = requestedTab ?? (isMobile ? "watchlist" : "goals");

  const settingsP = getOrCreateSettings(userId);
  const goalsDataP =
    !isMobile || activeTab === "goals"
      ? settingsP.then(async (settings) => {
          const [goalsWithProgress, rawAccounts] = await Promise.all([
            computeGoalsWithProgress(userId, settings.baseCurrency),
            fetchUserAccountsWithHoldings(userId),
          ]);
          return { goalsWithProgress, rawAccounts };
        })
      : Promise.resolve(undefined);
  const panelDataP = settingsP.then((settings) =>
    getGoalsPanelData({
      userId,
      isMobile,
      activeTab,
      baseCurrency: settings.baseCurrency,
      calendarMonth: month,
    }),
  );
  const [t, navT, messages, locale, settings, goalsData] = await Promise.all([
    getTranslations("goals"),
    getTranslations("nav"),
    getMessages(),
    getLocale(),
    settingsP,
    goalsDataP,
  ]);

  const accounts = goalsData?.rawAccounts.map(({ holdings: _h, ...rest }) => rest);
  const calendarToday = formatDateOnly(taiwanCalendarDay(new Date()));

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>
          <span className="md:hidden">{navT("plan")}</span>
          <span className="hidden md:inline">{t("title")}</span>
        </LargeTitleHeading>
        <Suspense fallback={<PanelSkeleton />}>
          <GoalsDeferredData
            activeTab={activeTab}
            requestedTab={requestedTab}
            eagerProps={{
              goalsWithProgress: goalsData?.goalsWithProgress,
              baseCurrency: settings.baseCurrency,
              accounts,
              calendarMonth: month,
              calendarSelectedDate: date,
              calendarToday,
              locale,
            }}
            panelDataP={panelDataP}
          />
        </Suspense>
      </div>
    </NextIntlClientProvider>
  );
}

export default function GoalsPage({ searchParams }: GoalsPageProps) {
  return <GoalsContent searchParams={searchParams} />;
}
