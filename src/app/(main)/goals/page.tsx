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
import type { SerializedAccount } from "@/lib/types";

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

async function GoalsContent({ searchParams }: GoalsPageProps) {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const { month, date } = normalizeCalendarUrlState(await searchParams);
  const { from, to } = getVisibleCalendarRange(month);

  const settingsP = getOrCreateSettings(userId);
  const [
    t,
    navT,
    messages,
    locale,
    goalsWithProgress,
    rawAccounts,
    projectionData,
    settings,
    stocks,
    calendarEntries,
  ] = await Promise.all([
    getTranslations("goals"),
    getTranslations("nav"),
    getMessages(),
    getLocale(),
    settingsP.then((s) => computeGoalsWithProgress(userId, s.baseCurrency)),
    fetchUserAccountsWithHoldings(userId),
    settingsP.then((s) => getProjectionData(userId, s.baseCurrency)),
    settingsP,
    getCachedTrackedStocks(userId),
    getCalendarEntriesInRange(userId, parseDateOnly(from)!, parseDateOnly(to)!),
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
        <GoalsView
          goalsWithProgress={goalsWithProgress}
          baseCurrency={settings.baseCurrency}
          accounts={accounts}
          projectionData={projectionData}
          stocks={stocks}
          calendarEntries={calendarEntries}
          calendarMonth={month}
          calendarSelectedDate={date}
          calendarToday={calendarToday}
          locale={locale}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function GoalsPage({ searchParams }: GoalsPageProps) {
  return <GoalsContent searchParams={searchParams} />;
}
