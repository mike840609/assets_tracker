import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { CalendarView } from "@/components/calendar/calendar-view";
import { taiwanCalendarDay } from "@/lib/app-day";
import {
  formatDateOnly,
  getVisibleCalendarRange,
  normalizeCalendarUrlState,
  parseDateOnly,
} from "@/lib/calendar-date";
import { getSession } from "@/lib/auth-session";
import { pickMessages } from "@/lib/i18n-utils";
import { getCalendarEntriesInRange } from "@/lib/services/calendar-entry-service";

const CLIENT_NAMESPACES = ["calendar", "common", "nav"];

type CalendarPageProps = {
  searchParams: Promise<{ month?: string; date?: string }>;
};

async function CalendarContent({ searchParams }: CalendarPageProps) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const { month, date } = normalizeCalendarUrlState(await searchParams);
  const { from, to } = getVisibleCalendarRange(month);
  const [messages, locale, entries] = await Promise.all([
    getMessages(),
    getLocale(),
    getCalendarEntriesInRange(session.user.id, parseDateOnly(from)!, parseDateOnly(to)!),
  ]);
  const today = formatDateOnly(taiwanCalendarDay(new Date()));

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <CalendarView
          initialEntries={entries}
          month={month}
          selectedDate={date}
          today={today}
          locale={locale}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function CalendarPage({ searchParams }: CalendarPageProps) {
  return <CalendarContent searchParams={searchParams} />;
}
