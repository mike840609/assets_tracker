import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { computeGoalsWithProgress } from "@/lib/services/goal-service";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import { getProjectionData } from "@/lib/services/projection-service";
import { getCachedTrackedStocks } from "@/lib/services/stock-watch-service";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GoalWithProgress, SerializedAccount } from "@/lib/types";

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
  searchParams: Promise<{ month?: string; date?: string }>;
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
  goalsWithProgress: GoalWithProgress[];
  baseCurrency: string;
  accounts: SerializedAccount[];
  calendarMonth: string;
  calendarSelectedDate: string;
  calendarToday: string;
  locale: string;
};

async function GoalsDeferredData({
  userId,
  eagerProps,
}: {
  userId: string;
  eagerProps: GoalsViewEagerProps;
}) {
  const { baseCurrency, calendarMonth } = eagerProps;
  const { from, to } = getVisibleCalendarRange(calendarMonth);
  const earningsLimited = rateLimitSubjectCheckWithPrune(
    userId,
    "yahoo",
    CALENDAR_EARNINGS_RATE_LIMIT,
  );
  const [projectionData, stocks, calendarEntries, calendarEarnings] = await Promise.all([
    getProjectionData(userId, baseCurrency),
    getCachedTrackedStocks(userId),
    getCalendarEntriesInRange(userId, parseDateOnly(from)!, parseDateOnly(to)!),
    earningsLimited
      ? Promise.resolve<CalendarEarningsItem[]>([])
      : getCalendarEarnings(userId, from, to),
  ]);

  const earningsByDate = new Map<string, CalendarEarningsItem[]>();
  for (const item of calendarEarnings) {
    const day = earningsByDate.get(item.date) ?? [];
    day.push(item);
    earningsByDate.set(item.date, day);
  }

  return (
    <GoalsView
      {...eagerProps}
      projectionData={projectionData}
      stocks={stocks}
      calendarEntries={calendarEntries}
      earningsByDate={earningsByDate}
    />
  );
}

async function GoalsContent({ searchParams }: GoalsPageProps) {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const { month, date } = normalizeCalendarUrlState(await searchParams);

  const settingsP = getOrCreateSettings(userId);
  const [
    t,
    navT,
    messages,
    locale,
    goalsWithProgress,
    rawAccounts,
    settings,
  ] = await Promise.all([
    getTranslations("goals"),
    getTranslations("nav"),
    getMessages(),
    getLocale(),
    settingsP.then((s) => computeGoalsWithProgress(userId, s.baseCurrency)),
    fetchUserAccountsWithHoldings(userId),
    settingsP,
  ]);

  const accounts: SerializedAccount[] = rawAccounts.map(({ holdings: _h, ...rest }) => rest);
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
            userId={userId}
            eagerProps={{
              goalsWithProgress,
              baseCurrency: settings.baseCurrency,
              accounts,
              calendarMonth: month,
              calendarSelectedDate: date,
              calendarToday,
              locale,
            }}
          />
        </Suspense>
      </div>
    </NextIntlClientProvider>
  );
}

export default function GoalsPage({ searchParams }: GoalsPageProps) {
  return <GoalsContent searchParams={searchParams} />;
}
