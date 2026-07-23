import { taiwanCalendarDay } from "@/lib/app-day";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ONLY = /^(\d{4})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return formatDateOnly(date) === value ? date : null;
}

function parseMonthKey(value: string): Date | null {
  const match = MONTH_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toISOString().slice(0, 7) === value ? date : null;
}

export function addCalendarDays(dateKey: string, amount: number): string {
  const date = parseDateOnly(dateKey);
  if (!date) throw new RangeError(`Invalid calendar date: ${dateKey}`);
  return formatDateOnly(new Date(date.getTime() + amount * DAY_MS));
}

export function moveCalendarMonth(dateKey: string, amount: number): string {
  const date = parseDateOnly(dateKey);
  if (!date) throw new RangeError(`Invalid calendar date: ${dateKey}`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + amount;
  const targetFirst = new Date(Date.UTC(year, month, 1));
  const targetLast = new Date(
    Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return formatDateOnly(
    new Date(
      Date.UTC(
        targetFirst.getUTCFullYear(),
        targetFirst.getUTCMonth(),
        Math.min(date.getUTCDate(), targetLast),
      ),
    ),
  );
}

export function buildMonthGrid(monthKey: string): string[] {
  const first = parseMonthKey(monthKey);
  if (!first) throw new RangeError(`Invalid calendar month: ${monthKey}`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - mondayOffset * DAY_MS);
  return Array.from({ length: 42 }, (_, index) =>
    formatDateOnly(new Date(start.getTime() + index * DAY_MS)),
  );
}

export function getVisibleCalendarRange(monthKey: string) {
  const days = buildMonthGrid(monthKey);
  return { from: days[0], to: days[41] };
}

export function getCalendarRangeLength(from: string, to: string): number {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (!fromDate || !toDate) return 0;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
}

export function normalizeCalendarUrlState(
  input: { month?: string | null; date?: string | null },
  now: Date = new Date(),
) {
  const fallback = formatDateOnly(taiwanCalendarDay(now));
  const selected = input.date ? parseDateOnly(input.date) : null;
  const month = input.month ? parseMonthKey(input.month) : null;
  if (!selected || !month) return { month: fallback.slice(0, 7), date: fallback };
  const date = formatDateOnly(selected);
  return { month: date.slice(0, 7), date };
}
