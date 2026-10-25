import { withAuth } from "@/lib/api-handler";
import { failure, ok, validationError } from "@/lib/api-responses";
import { calendarEntriesRangeSchema } from "@/lib/validators";
import {
  CALENDAR_EARNINGS_RATE_LIMIT,
  getCalendarEarnings,
} from "@/lib/services/calendar-earnings-data";
import { rateLimitCheckWithPrune, rateLimitKeyForSubject } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

/**
 * Async earnings feed for the calendar. The page no longer awaits a provider
 * quote during render; the client fetches this after hydration and shows an
 * explicit unavailable state if the quote cannot be loaded.
 */
export const GET = withAuth(
  async (request, _ctx, userId) => {
    const limited = rateLimitCheckWithPrune(request, {
      ...CALENDAR_EARNINGS_RATE_LIMIT,
      key: rateLimitKeyForSubject(userId, "calendar-earnings"),
    });
    if (limited) return limited;

    const url = new URL(request.url);
    const parsed = calendarEntriesRangeSchema.safeParse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!parsed.success) return validationError(parsed.error);

    try {
      const earnings = await getCalendarEarnings(userId, parsed.data.from, parsed.data.to);
      return ok({ earnings });
    } catch (error) {
      log.error("calendar.earnings.route_failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return failure("Failed to load earnings", 500);
    }
  },
  { demo: "allow" },
);
