import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function localToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateToUtcMidnight(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function daysBetweenDates(startDate: string, endDate: string) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((dateToUtcMidnight(endDate) - dateToUtcMidnight(startDate)) / DAY_MS),
  );
}
