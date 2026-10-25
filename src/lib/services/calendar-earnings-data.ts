import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { log } from "@/lib/logger";
import { getYahooClient } from "@/lib/services/yahoo-client";
import { getCalendarEarningsWatch } from "@/lib/services/calendar-earnings-service";
import {
  mapEarningsCallToTaiwanDay,
  mapEarningsTimestampToTaiwanDay,
  type EarningsSession,
} from "@/lib/calendar-earnings";

export type CalendarEarningsItem = {
  date: string;
  symbol: string;
  name: string;
  session: EarningsSession;
  isEstimate: boolean;
  epsForward: number | null;
};

const FETCH_TIMEOUT_MS = 5_000;

export const CALENDAR_EARNINGS_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000,
  prefix: "calendar-earnings",
} as const;

async function getCachedCalendarEarnings(
  userId: string,
  from: string,
  to: string,
): Promise<CalendarEarningsItem[]> {
  "use cache";
  cacheTag(`calendar-earnings:${userId}`);
  cacheLife("hours");

  const watch = await getCalendarEarningsWatch(userId);
  const symbols = watch.map((w) => w.symbol);
  if (symbols.length === 0) return [];

  const yahooFinance = await getYahooClient();
  const quotes = await Promise.race([
    yahooFinance.quote(symbols),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Yahoo Finance request timed out")), FETCH_TIMEOUT_MS),
    ),
  ]);
  const list = Array.isArray(quotes) ? quotes : [quotes];

  const items: CalendarEarningsItem[] = [];
  for (const q of list) {
    if (!q?.symbol) continue;
    const name = watch.find((w) => w.symbol === q.symbol)?.name ?? q.symbol;
    const callStart = q.earningsCallTimestampStart;
    const earningsTimestamp = q.earningsTimestamp;
    if (!callStart && !earningsTimestamp) continue;
    const mapped = callStart
      ? mapEarningsCallToTaiwanDay(callStart)
      : mapEarningsTimestampToTaiwanDay(earningsTimestamp);
    if (mapped.date < from || mapped.date > to) continue;
    items.push({
      date: mapped.date,
      symbol: q.symbol,
      name,
      session: mapped.session,
      isEstimate: q.isEarningsDateEstimate ?? false,
      epsForward: typeof q.epsForward === "number" ? q.epsForward : null,
    });
  }
  return items;
}

export async function getCalendarEarnings(
  userId: string,
  from: string,
  to: string,
): Promise<CalendarEarningsItem[]> {
  try {
    return await getCachedCalendarEarnings(userId, from, to);
  } catch (error) {
    log.error("calendar.earnings.yahoo_failed", { error: String(error) });
    // Let the API route return a 5xx so the client can show a retry state
    // instead of silently rendering an empty calendar.
    throw error;
  }
}
